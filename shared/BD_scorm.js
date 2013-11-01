var BLUEDROP = BLUEDROP || {};

(function() {
    BLUEDROP.ScormHelper = function(options, scormWrapper) {
        var settings = {
            win: window,
            trackDuration: true,
            masteryScore: null,
            debug: false
        };
        
        if (scormWrapper === undefined) {
            scormWrapper = window.pipwerks;
        }

        for (var option in options) {
            settings[option] = options[option];
        }
        
        scormWrapper.debug.isActive = settings.debug;
        
        var scorm, startTimestamp, endTimestamp;
        scorm = scormWrapper.SCORM;
        
        addEvent(settings.win, 'load', function() {
            startTimeStamp = new Date();
            scormWrapper.SCORM.init();
        });
        addEvent(settings.win, 'unload', function() {
            endTimestamp = new Date();
            if (settings.trackDuration) {
                setSessionTime(endTimestamp - startTimestamp);
            }
            scorm.quit();
        });
        
        var cmi_elements = {
            '1.2': {
                'completion': 'cmi.core.lesson_status',
                'success': 'cmi.core.lesson_status',
                'bookmark': 'cmi.core.lesson_location',
                'score': 'cmi.core.score.raw',
                'learner': 'cmi.student_name',
                'sessiontime': 'cmi.core.session_time',
                'totaltime': 'cmi.core.total_time',
                'mode': 'cmi.core.lesson_mode'
            },
            '2004': {
                'completion': 'cmi.completion_status',
                'success': 'cmi.success_status',
                'bookmark': 'cmi.location',
                'score': 'cmi.score.raw',
                'learner': 'cmi.learner_name',
                'sessiontime': 'cmi.core.session_time',
                'totaltime': 'cmi.total_time',
                'mode': 'cmi.mode'
            }
        }
        
        function setPassed() {
            return scorm.set(cmi_elements[scorm.version]['success'], 'passed') && scorm.save();
        },
        function setFailed() {
            return scorm.set(cmi_elements[scorm.version]['completion'], 'failed') && scorm.save();
        },
        
        return {
            getBookmark: function() {
                return scorm.get(cmi_elements[scorm.version]['bookmark']);
            },
            setBookmark: function(bookmark) {
                return scorm.set(cmi_elements[scorm.version]['bookmark'], bookmark) && scorm.save();
            },
            isComplete: function() {
                return scorm.get(cmi_elements[scorm.version]['completion']) == 'completed' ||
                    scorm.get(cmi_elements[scorm.version]['success']) == 'passed';
            },
            getSuccessStatus: function() {
                var success = scorm.get(cmi_elements[scorm.version]['success']);
                if (success != 'passed' && success != 'failed') {
                    success = 'unknown';
                }
                return success;
            }
            setComplete: function() {
                return scorm.set(cmi_elements[scorm.version]['completion'], 'completed') && scorm.save();
            },
            setIncomplete: function() {
                return scorm.set(cmi_elements[scorm.version]['completion'], 'incomplete') && scorm.save();
            },
            setPassed: setPassed,
            setFailed: setFailed,
            getScore: function() {
                return scorm.get(cmi_elements[scorm.version]['score']);
            },
            setScore: function(score) {
                scorm.set(cmi_elements[scorm.version]['score'], score);
                
                if (options.masteryScore) {
                    if (score > options.masteryScore) {
                        return setPassed();
                    } else {
                        return setFailed();
                    }
                }
            },
            setSessionTime: function(seconds) {
                return scorm.set(cmi_elements[scorm.version]['completion'], ConvertMilliSecondsToSCORMTime(seconds)) && scorm.save();
            }
            getTotalTime: function() {
                return scorm.get(cmi_elements[scorm.version]['total_time']);
            }
        }
    }

    function addEvent(element, event, fn) {
        if (element.addEventListener)
            element.addEventListener(event, fn, false);
        else if (element.attachEvent)
            element.attachEvent('on' + event, fn);
    }

    function ConvertMilliSecondsToSCORMTime(intTotalMilliseconds, blnIncludeFraction){

        var intHours;
        var intintMinutes;
        var intSeconds;
        var intMilliseconds;
        var intHundredths;
        var strCMITimeSpan;
        
        if (blnIncludeFraction == null || blnIncludeFraction == undefined){
            blnIncludeFraction = true;
        }
        
        //extract time parts
        intMilliseconds = intTotalMilliseconds % 1000;

        intSeconds = ((intTotalMilliseconds - intMilliseconds) / 1000) % 60;

        intMinutes = ((intTotalMilliseconds - intMilliseconds - (intSeconds * 1000)) / 60000) % 60;

        intHours = (intTotalMilliseconds - intMilliseconds - (intSeconds * 1000) - (intMinutes * 60000)) / 3600000;

        /*
        deal with exceptional case when content used a huge amount of time and interpreted CMITimstamp 
        to allow a number of intMinutes and seconds greater than 60 i.e. 9999:99:99.99 instead of 9999:60:60:99
        note - this case is permissable under SCORM, but will be exceptionally rare
        */

        if (intHours == 10000) 
        {   
            intHours = 9999;

            intMinutes = (intTotalMilliseconds - (intHours * 3600000)) / 60000;
            if (intMinutes == 100) 
            {
                intMinutes = 99;
            }
            intMinutes = Math.floor(intMinutes);
            
            intSeconds = (intTotalMilliseconds - (intHours * 3600000) - (intMinutes * 60000)) / 1000;
            if (intSeconds == 100) 
            {
                intSeconds = 99;
            }
            intSeconds = Math.floor(intSeconds);
            
            intMilliseconds = (intTotalMilliseconds - (intHours * 3600000) - (intMinutes * 60000) - (intSeconds * 1000));
        }

        //drop the extra precision from the milliseconds
        intHundredths = Math.floor(intMilliseconds / 10);

        //put in padding 0's and concatinate to get the proper format
        strCMITimeSpan = ZeroPad(intHours, 4) + ":" + ZeroPad(intMinutes, 2) + ":" + ZeroPad(intSeconds, 2);
        
        if (blnIncludeFraction){
            strCMITimeSpan += "." + intHundredths;
        }

        //check for case where total milliseconds is greater than max supported by strCMITimeSpan
        if (intHours > 9999) 
        {
            strCMITimeSpan = "9999:99:99";
            
            if (blnIncludeFraction){
                strCMITimeSpan += ".99";
            }
        }

        return strCMITimeSpan;
        
    }

    function ZeroPad(intNum, intNumDigits){

        var strTemp;
        var intLen;
        var i;
        
        strTemp = new String(intNum);
        intLen = strTemp.length;
        
        if (intLen > intNumDigits){
            strTemp = strTemp.substr(0,intNumDigits);
        }
        else{
            for (i=intLen; i<intNumDigits; i++){
                strTemp = "0" + strTemp;
            }
        }
        
        return strTemp;
    }
})();