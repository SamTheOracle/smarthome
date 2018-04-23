import io
import random
import picamera
from picamera.array import PiRGBArray
import cv2
import time
import datetime
import sys

firstFrame = None  # this is the first frame picked and will be the reference model
count = 0
countff = 0
# pointer to the time first frame was picked in order
#  to change it at regular intervals for light changes
timeFirstFrame = datetime.datetime.now().minute
frame_count = 0
detected = False


def detect_motion(camera):
    global firstFrame
    global count
    global countff
    global timeFirstFrame
    global detected
    global frame_count
    rawCapture = PiRGBArray(camera)
    # picamera method to get a frame in the current video as a numpy array for OpenCV
    for frame in camera.capture_continuous(rawCapture, format="bgr", use_video_port=True):
        current_frame = cv2.cvtColor(frame.array, cv2.COLOR_BGR2GRAY)
        frame_count += 1
        rawCapture.truncate(0)
        current_frame = cv2.GaussianBlur(current_frame, (21, 21), 0)
        # if the first frame is None, initialize it: first frame is the static backbround used for comparing other frames

        if firstFrame is None or updateBackgroundModel(timeFirstFrame):
            print('updating background model')
            firstFrame = current_frame
            timeFirstFrame = datetime.datetime.now().minute
            nameff = 'firstframe'+str(countff)+'.jpg'
            countff += 1
            cv2.imwrite(nameff, firstFrame)
            # continue

        # compute the absolute difference between the current frame and
        # first frame
        frameDelta = cv2.absdiff(firstFrame, current_frame)
        name2 = 'debugdelta'+str(count)+'.jpg'

        thresh = cv2.threshold(frameDelta, 20, 255, cv2.THRESH_BINARY)[1]

        thresh = cv2.dilate(thresh, None, iterations=2)

        name = 'diff'+str(count)+'.jpg'
        count += 1

        if cv2.countNonZero(thresh) > 30000:
            print('motion detected for frame '+name)
            #cv2.imwrite(name, thresh)
            cv2.imwrite(name2,frameDelta)
            detected = True
            break
            #return True
    
    if detected:
        detected = False
        print('returning true')
        return True
    else:
        return False
            


def updateBackgroundModel(timeFirstFrame):
    # update background model every 10 minutes
    global frame_count
    if frame_count == 10:
        frame_count = 0
        return True
    else:
        return False


with picamera.PiCamera() as camera:
    stream = picamera.PiCameraCircularIO(camera, seconds=5)
    camera.framerate = 32
    global detect_motion
    if(sys.stdin.readline() == "start recording\n"):
        camera.start_recording(stream, format='h264')
        try:
            while True:
                camera.wait_recording(1)
                if :

                    while detect_motion(camera):
                        camera.wait_recording(1)
                    print('Motion stopped!')
                    now_day = datetime.datetime.now().day
                    now_month = datetime.datetime.now().month
                    now_year = datetime.datetime.now().year
                    now_hour = datetime.datetime.now().hour
                    now_minute = datetime.datetime.now().minute
                    now_second = datetime.datetime.now().second
                    filename = 'motion'+'-'+str(now_day)+'_'+str(now_month)+'_'+str(
                        now_year)+'-'+str(now_hour)+'_'+str(now_minute)+'_'+str(now_second)+'.h264'
                    stream.copy_to(filename, seconds=10)
                    print('video recorded at '+filename)
                    if(sys.stdin.readline() == "keep going\n"):
                        continue
        finally:
            camera.stop_recording()
