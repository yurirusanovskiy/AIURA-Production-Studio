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
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface DeleteSceneModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sceneTitle: string;
  isDeleting: boolean;
}

export default function DeleteSceneModal({
  open,
  onClose,
  onConfirm,
  sceneTitle,
  isDeleting,
}: DeleteSceneModalProps) {
  return (
    <Dialog
      open={open}
      onClose={isDeleting ? undefined : onClose}
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
        <WarningAmberIcon color="error" />
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          Delete Chapter
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body1" sx={{ color: '#E2E8F0', mb: 2 }}>
          Are you sure you want to delete <strong>{sceneTitle}</strong>?
        </Typography>
        <Typography variant="body2" sx={{ color: '#94A3B8' }}>
          This will permanently delete this chapter, all its dialogue lines, recorded takes, and all associated audio files on disk. This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button
          onClick={onClose}
          disabled={isDeleting}
          sx={{ color: '#94A3B8', textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={isDeleting}
          startIcon={
            isDeleting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <DeleteForeverIcon />
            )
          }
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
        >
          {isDeleting ? 'Deleting...' : 'Delete Chapter'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
