'use client';

import * as React from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { notificationService, NotificationEvent } from '@/lib/notifications';

export function NotificationContainer() {
  const [open, setOpen] = React.useState(false);
  const [notification, setNotification] =
    React.useState<NotificationEvent | null>(null);

  React.useEffect(() => {
    return notificationService.subscribe((event) => {
      setNotification(event);
      setOpen(true);
    });
  }, []);

  const handleClose = (
    event?: React.SyntheticEvent | Event,
    reason?: string,
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={notification?.duration ?? 6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      {notification ? (
        <Alert
          onClose={handleClose}
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%', boxShadow: 3 }}
        >
          {notification.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}
