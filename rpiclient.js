
var Gpio = require('onoff').Gpio; //include onoff to interact with the GPIO
var LED = new Gpio(4, 'out'); //use GPIO pin 4, and specify that it is output
var ip = require('ip')
var io = require('socket.io-client')
var rpiInquirer = require('./dbhandlermodules/rpinquirer')
var PythonShell = require('python-shell')
var rpiInquirer = require('./dbhandlermodules/rpinquirer')
var fs = require('fs')
var growingFile = require('growing-file')
var request = require('request')
var progress = require('progress-stream')
var Transcoder = require('stream-transcoder')
var stringUrl = "http://192.168.1.242:3000"
//var stringUrl = "https://smartsecurityhome.herokuapp.com"
var socket = io(stringUrl, { transports: ['websocket'] })
var ipAddress = ip.address()

var options = {
    mode: 'text',
    pythonOptions: ['-u'],
    pythonPath: '/usr/bin/python3'
}

var user
var deviceName
var on = false


socket.on('connect', function () {
    console.log('connected')
    console.log(socket.id)

    if (typeof user === "undefined") {
        rpiInquirer.startRPIAuth(socket)
    }
    socket.on('error login', function (data) {
        console.log('The identity provided is wrong, please insert correct values')
        rpiInquirer.startRPIAuth(socket)

    })

    socket.on('user loggedin', function (data) {
        console.log('logging in ' + data.username)
        user = data.username
        console.log('username registered! ', user)
      
        socket.emit('room', { username: user, devicename:deviceName})
    })



    socket.on('leave room', function (data) {


        if (data.ipaddress === ipAddress) {
            console.log('Im leaving the room :(')
            on = false

            socket.emit('save status on db', { ipaddress: ipAddress, status: false, username: data.username })
        }
    })


})



socket.on('disconnect', function () {
    console.log('\ndisconnected ')
    if (typeof user !== 'undefined')

        socket.emit('leave room', { devicename: deviceName, username: user })
    //socket.emit('save status on db',{ipaddress:ipAddress,status:false,username:user})


})

socket.on('reconnect', function () {
    console.log('reconnected')
    if (typeof user !== 'undefined')
        socket.emit('room', { username: user })
})

socket.on('rpi', function (data) {
    on = true
    console.log('my data: ' + data.ipaddress)
    if (deviceName===data.devicename) {
        user = data.username
        console.log('i was found!')
        socket.emit('room', data)
        socket.emit('save status on db', { ipaddress: ipAddress, status: true, username: data.username })

    }
    else {
        console.log('sorry its not me')
    }
})



socket.on('turn on/off light', function (data) {

    if (LED.readSync() === 0 && data.light && deviceName === data.devicename && on) { //check the pin state, if the state is 0 (or off)
        console.log('data arrived: ' + data.light)
        LED.writeSync(1); //set pin state to 1 (turn LED on)
        console.log('turning on light')
    }
    else if (deviceName === data.devicename) {

        LED.writeSync(0)
        console.log('turning off light')

    }
})



socket.on('turn on/off video', function (data) {//properties video:bool, devicename:string
    var shell = new PythonShell('camerascript.py', options)


    if (data.video && deviceName === data.devicename && on) { //check if device is on before working
        console.log('data arrived: ' + data.video)
        console.log('turning on video')

        shell.send('start recording')
        shell.on('message', function (message) {
            console.log(message)
            
            if (message.trim().split('videorecorded')[1]!=null) {
                filename = message.trim().split('videorecorded')[1]
                console.log('streaming starting')
                var stat = fs.statSync(filename)
                var stream = progress({
                    length: stat.size,
                    time: 10
                })
                stream.on('progress', function (progress) {
                    console.log('eta: ' + progress.eta + ' percentage: ' + progress.percentage)
                    if (progress.percentage === 100) {
                        console.log('uploaded!!!')
                        socket.emit('video uploaded',{roomname:user,devicename:deviceName})
                        fs.unlink(filenames,function(error){
                            if(error){
                                console.log(error)
                            }
                            /* else{
//
                                shell.send('keep going')
                            } */
                        })
                       

                    }

                })
                var optionPost = {
                    uri: stringUrl + '/postvideo?devicename=' + deviceName + '',
                    headers: { username: user }

                }
                var postFileRequest = request.post(optionPost)
                var file = fs.createReadStream(filename)
                new Transcoder(file)
                    .videoCodec('h264')
                    .fps(25)
                    .format('mp4')
                    .stream()
                    .pipe(stream)
                    .pipe(postFileRequest)


            }

        })

    }
    else if (deviceName === data.devicename) {
        shell.send('stop camera')
        fs.unlink('motion.h264', function (err) {
            if (err)
                console.log(err)
        })
        console.log('turning off video')

    }
})
exports.setDeviceName=(devicename)=>{
    deviceName=devicename
}

