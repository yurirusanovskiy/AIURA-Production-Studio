import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isPending?: boolean;
  severity?: 'error' | 'warning' | 'info';
}

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isPending = false,
  severity = 'error',
}: ConfirmModalProps) {
  const getIconColor = () => {
    switch (severity) {
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'error';
    }
  };

  const getButtonColor = () => {
    switch (severity) {
      case 'warning':
        return 'warning';
      case 'info':
        return 'primary';
      default:
        return 'error';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isPending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: { sx: { bgcolor: '#1A212D', color: '#fff', borderRadius: 3 } },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <WarningAmberIcon color={getIconColor()} />
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body1" sx={{ color: '#E2E8F0' }}>
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button
          onClick={onClose}
          disabled={isPending}
          sx={{ color: '#94A3B8', textTransform: 'none' }}
        >
          {cancelText}
        </Button>
        <Button
          variant="contained"
          color={getButtonColor()}
          onClick={onConfirm}
          disabled={isPending}
          startIcon={
            isPending ? (
              <CircularProgress size={20} color="inherit" />
            ) : undefined
          }
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
        >
          {isPending ? 'Processing...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
