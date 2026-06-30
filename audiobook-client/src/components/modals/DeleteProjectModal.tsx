import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  Box,
  CircularProgress,
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface DeleteProjectModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  projectTitle: string;
  isDeleting: boolean;
}

export default function DeleteProjectModal({
  open,
  onClose,
  onConfirm,
  projectTitle,
  isDeleting,
}: DeleteProjectModalProps) {
  const [confirmText, setConfirmText] = useState('');

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  const isMatched = confirmText.trim() === projectTitle.trim();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
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
          Delete Project
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body1" sx={{ color: '#E2E8F0', mb: 2 }}>
          You are about to delete <strong>{projectTitle}</strong>.
        </Typography>
        <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3 }}>
          This will permanently delete the project, all its scenes, extracted
          scripts, and all generated audio files on disk. Character profiles
          will be preserved.
        </Typography>

        <Box
          sx={{
            bgcolor: 'rgba(244, 67, 54, 0.1)',
            p: 2,
            borderRadius: 2,
            mb: 3,
            border: '1px solid rgba(244, 67, 54, 0.2)',
          }}
        >
          <Typography variant="body2" color="error">
            This action cannot be undone. Please type the project name to
            confirm:
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, mt: 1, mb: 1, userSelect: 'all' }}
          >
            {projectTitle}
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type project name here..."
            disabled={isDeleting}
            sx={{
              input: { color: '#fff' },
              bgcolor: 'rgba(0,0,0,0.2)',
              borderRadius: 1,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&.Mui-focused fieldset': { borderColor: '#F44336' },
              },
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button
          onClick={handleClose}
          disabled={isDeleting}
          sx={{ color: '#94A3B8', textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            if (isMatched) onConfirm();
          }}
          disabled={!isMatched || isDeleting}
          startIcon={
            isDeleting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <DeleteForeverIcon />
            )
          }
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
        >
          {isDeleting ? 'Deleting...' : 'Delete Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
