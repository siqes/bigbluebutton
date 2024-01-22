import React, { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import humanizeSeconds from '/imports/utils/humanizeSeconds';
import { setCapturedContentUploading } from './service';
import { Text, Time } from './styles';
import useMeeting from '/imports/ui/core/hooks/useMeeting';
import { useSubscription } from '@apollo/client';
import { FIRST_BREAKOUT_DURATION_DATA_SUBSCRIPTION, breakoutDataResponse } from './queries';
import { notify } from '/imports/ui/services/notification';
import { Meteor } from 'meteor/meteor';
import useTimeSync from '/imports/ui/core/local-states/useTimeSync';
import logger from '/imports/startup/client/logger';

const intlMessages = defineMessages({
  breakoutTimeRemaining: {
    id: 'app.breakoutTimeRemainingMessage',
    description: 'Message that tells how much time is remaining for the breakout room',
  },
  breakoutDuration: {
    id: 'app.createBreakoutRoom.duration',
    description: 'breakout duration time',
  },
  meetingTimeRemaining: {
    id: 'app.meeting.meetingTimeRemaining',
    description: 'Message that tells how much time is remaining for the meeting',
  },
  breakoutWillClose: {
    id: 'app.breakoutWillCloseMessage',
    description: 'Message that tells time has ended and breakout will close',
  },
  meetingWillClose: {
    id: 'app.meeting.meetingTimeHasEnded',
    description: 'Message that tells time has ended and meeting will close',
  },
  calculatingBreakoutTimeRemaining: {
    id: 'app.calculatingBreakoutTimeRemaining',
    description: 'Message that tells that the remaining time is being calculated',
  },
  alertBreakoutEndsUnderMinutes: {
    id: 'app.meeting.alertBreakoutEndsUnderMinutes',
    description: 'Alert that tells that the breakout ends under x minutes',
  },
  alertMeetingEndsUnderMinutes: {
    id: 'app.meeting.alertMeetingEndsUnderMinutes',
    description: 'Alert that tells that the meeting ends under x minutes',
  },
});

interface MeetingRemainingTimeContainerProps {
  isBreakoutDuration: boolean | false;
  fromBreakoutPanel: boolean;
  displayAlerts: boolean;
}

interface MeetingRemainingTimeProps extends MeetingRemainingTimeContainerProps {
  durationInSeconds: number;
  referenceStartedTime: number;
  isBreakout: boolean | false;
}

const METEOR_SETTINGS_APP = Meteor.settings.public.app;
const REMAINING_TIME_ALERT_THRESHOLD_ARRAY: [number] = METEOR_SETTINGS_APP.remainingTimeAlertThresholdArray;

let lastAlertTime: number | null = null;

const MeetingRemainingTime: React.FC<MeetingRemainingTimeProps> = (props) => {
  const {
    durationInSeconds,
    isBreakoutDuration,
    referenceStartedTime,
    fromBreakoutPanel,
    displayAlerts,
    isBreakout,
  } = props;

  const intl = useIntl();
  const [timeSync] = useTimeSync();
  const timeRemainingInterval = React.useRef<ReturnType<typeof setTimeout>>();
  const [remainingTime, setRemainingTime] = useState<number>(-1);

  const currentDate: Date = new Date();
  const adjustedCurrent: Date = new Date(currentDate.getTime() + timeSync);

  const calculateRemainingTime = () => {
    const durationInMilliseconds = durationInSeconds * 1000;
    const adjustedCurrentTime = adjustedCurrent.getTime();

    return Math.floor(((referenceStartedTime + durationInMilliseconds) - adjustedCurrentTime) / 1000);
  };

  useEffect(() => {
    if (remainingTime && durationInSeconds) {
      if (durationInSeconds > 0 && timeRemainingInterval && referenceStartedTime) {
        setRemainingTime(calculateRemainingTime());
      }

      clearInterval(timeRemainingInterval.current);
      const remainingMillisecondsDiff = (
        (referenceStartedTime + (durationInSeconds * 60000)) - adjustedCurrent.getTime()
      ) % 1000;
      timeRemainingInterval.current = setInterval(() => {
        setRemainingTime((currentTime) => currentTime - 1);
      }, remainingMillisecondsDiff === 0 ? 1000 : remainingMillisecondsDiff);
    }

    return () => {
      clearInterval(timeRemainingInterval.current);
    };
  }, [remainingTime, durationInSeconds]);

  const meetingTimeMessage = React.useRef<string>('');
  const boldText = React.useRef<boolean>(false);

  if (remainingTime >= 0 && timeRemainingInterval) {
    if (remainingTime > 0) {
      const alertsInSeconds = REMAINING_TIME_ALERT_THRESHOLD_ARRAY.map((item) => item * 60);

      if (alertsInSeconds.includes(remainingTime) && remainingTime !== lastAlertTime && displayAlerts) {
        const timeInMinutes = remainingTime / 60;
        const message = isBreakoutDuration
          ? intlMessages.alertBreakoutEndsUnderMinutes
          : intlMessages.alertMeetingEndsUnderMinutes;
        const msg = { id: `${message.id}${timeInMinutes === 1 ? 'Singular' : 'Plural'}` };
        const alertMessage = intl.formatMessage(msg, { 0: timeInMinutes });

        lastAlertTime = remainingTime;
        notify(alertMessage, 'info', 'rooms');
      }

      if (isBreakout) {
        const breakoutMessage = intl.formatMessage(
          intlMessages.breakoutTimeRemaining,
          { 0: humanizeSeconds(remainingTime) },
        );

        return (
          <span data-test="timeRemaining">
            {breakoutMessage}
          </span>
        );
      }

      if (fromBreakoutPanel) boldText.current = true;
      meetingTimeMessage.current = intl.formatMessage(fromBreakoutPanel || isBreakoutDuration
        ? intlMessages.breakoutDuration
        : intlMessages.meetingTimeRemaining, { 0: humanizeSeconds(remainingTime) });
    } else {
      clearInterval(timeRemainingInterval.current);
      setCapturedContentUploading();
      meetingTimeMessage.current = intl.formatMessage(isBreakoutDuration
        ? intlMessages.breakoutWillClose
        : intlMessages.meetingWillClose);
    }
  }

  if (boldText.current) {
    const words = meetingTimeMessage.current.split(' ');
    const time = words.pop();
    const text = words.join(' ');

    return (
      <span data-test="timeRemaining">
        <Text>{text}</Text>
        <br />
        <Time data-test="breakoutRemainingTime">{time}</Time>
      </span>
    );
  }

  return (
    <span data-test="timeRemaining">
      {meetingTimeMessage.current}
    </span>
  );
};

const MeetingRemainingTimeContainer: React.FC<MeetingRemainingTimeContainerProps> = ({
  fromBreakoutPanel,
  isBreakoutDuration,
  displayAlerts,
}) => {
  const intl = useIntl();
  const loadingRemainingTime = () => {
    return (
      <span>
        {intl.formatMessage(intlMessages.calculatingBreakoutTimeRemaining)}
      </span>
    );
  };

  if (isBreakoutDuration) {
    const {
      data: breakoutData,
      loading: breakoutLoading,
      error: breakoutError,
    } = useSubscription<breakoutDataResponse>(FIRST_BREAKOUT_DURATION_DATA_SUBSCRIPTION);

    if (breakoutLoading) return loadingRemainingTime();
    if (!breakoutData) return null;
    if (breakoutError) {
      logger.error('Error when loading breakout data', breakoutError);
      return (
        <div>
          Error:
          {JSON.stringify(breakoutError)}
        </div>
      );
    }

    const breakoutDuration: number = breakoutData.breakoutRoom[0]?.durationInSeconds;
    const breakoutStartedAt: string = breakoutData.breakoutRoom[0]?.startedAt;
    const breakoutStartedTime = new Date(breakoutStartedAt).getTime();

    return (
      <MeetingRemainingTime
        durationInSeconds={breakoutDuration}
        referenceStartedTime={breakoutStartedTime}
        fromBreakoutPanel={fromBreakoutPanel}
        displayAlerts={displayAlerts}
        isBreakoutDuration
        isBreakout={false}
      />
    );
  }

  const currentMeeting = useMeeting((m) => {
    return {
      isBreakout: m.isBreakout,
      durationInSeconds: m.durationInSeconds,
      createdTime: m.createdTime,
    };
  });

  if (!currentMeeting) return loadingRemainingTime();

  const { isBreakout } = currentMeeting;
  const meetingDurationInSeconds: number = currentMeeting.durationInSeconds ?? 0;
  const meetingCreatedTime: number = currentMeeting.createdTime ?? 0;

  return (
    <MeetingRemainingTime
      durationInSeconds={meetingDurationInSeconds}
      referenceStartedTime={meetingCreatedTime}
      fromBreakoutPanel={fromBreakoutPanel}
      isBreakoutDuration={!!isBreakout}
      displayAlerts={displayAlerts}
      isBreakout={!!isBreakout}
    />
  );
};

export default MeetingRemainingTimeContainer;
