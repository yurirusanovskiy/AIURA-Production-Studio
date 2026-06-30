import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Loader2,
  Download,
} from 'lucide-react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined';
import AudioFileOutlinedIcon from '@mui/icons-material/AudioFileOutlined';

interface AudioPlayerBarProps {
  audioUrl?: string | null;
  isGenerating?: boolean;
  onGenerate?: () => void;
  onDownloadStems?: () => void;
  onDownloadFull?: () => void;
  allowDownloads?: boolean;
  isAllLinesGenerated?: boolean;
}

export function AudioPlayerBar({
  audioUrl,
  isGenerating = false,
  onGenerate,
  onDownloadStems,
  onDownloadFull,
  allowDownloads = false,
  isAllLinesGenerated = false,
}: AudioPlayerBarProps) {
  const isGenerated = !!audioUrl;
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloadAnchorEl, setDownloadAnchorEl] = useState<null | HTMLElement>(
    null,
  );
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync isPlaying state with actual audio playback
  useEffect(() => {
    if (!audioRef.current || !isGenerated) return;

    if (isPlaying) {
      audioRef.current.play().catch((e) => {
        console.error('Playback failed:', e);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, isGenerated, audioUrl]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration) {
        setProgress(
          (audioRef.current.currentTime / audioRef.current.duration) * 100,
        );
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setTotalDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const fmt = (s: number) => {
    if (isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 88, // Account for sidebar width
        right: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        px: 4,
        py: 2,
        background: 'rgba(21, 26, 37, 0.85)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
      }}
    >
      {audioUrl && (
        <audio
          key={audioUrl}
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          style={{ display: 'none' }}
        />
      )}

      {/* Generate button */}
      <Button
        onClick={onGenerate}
        disabled={isGenerating}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 3,
          py: 1.2,
          borderRadius: 3,
          flexShrink: 0,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          transition: 'all 0.2s',
          background: isGenerated
            ? 'linear-gradient(135deg, #a5b4fc 0%, #c4b5fd 100%)'
            : 'linear-gradient(135deg, #90caf9 0%, #a5b4fc 100%)',
          color: '#0f172a',
          border: 'none',
          boxShadow: isGenerated
            ? '0 0 20px rgba(165,180,252,0.35)'
            : '0 0 20px rgba(144,202,249,0.35)',
          '&:hover': {
            background: isGenerated
              ? 'linear-gradient(135deg, #c4b5fd 0%, #ddd6fe 100%)'
              : 'linear-gradient(135deg, #90caf9 0%, #a5b4fc 100%)',
            opacity: 0.9,
          },
          '&.Mui-disabled': {
            opacity: 0.6,
            color: '#0f172a',
          },
        }}
      >
        {isGenerating ? (
          <>
            <Loader2
              size={16}
              className="animate-spin"
              style={{ animation: 'spin 1s linear infinite' }}
            />{' '}
            Processing…
          </>
        ) : isAllLinesGenerated ? (
          <>⚡ Stitch & Update Scene</>
        ) : (
          <>⚡ Generate Audio</>
        )}
      </Button>

      {/* Player controls */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}
      >
        <IconButton
          disabled={!isGenerated}
          onClick={() => {
            if (audioRef.current) audioRef.current.currentTime = 0;
          }}
          sx={{
            color: '#94a3b8',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            '&.Mui-disabled': { color: 'rgba(148,163,184,0.3)' },
          }}
        >
          <SkipBack size={18} />
        </IconButton>

        <IconButton
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={!isGenerated}
          sx={{
            width: 44,
            height: 44,
            bgcolor: '#f48fb1',
            color: '#0f172a',
            borderRadius: 3,
            '&:hover': { bgcolor: '#f06292', opacity: 0.9 },
            '&.Mui-disabled': {
              bgcolor: '#f48fb1',
              opacity: 0.3,
              color: '#0f172a',
            },
          }}
        >
          {isPlaying ? (
            <Pause size={20} />
          ) : (
            <Play size={20} style={{ marginLeft: 2 }} />
          )}
        </IconButton>

        <IconButton
          disabled={!isGenerated}
          onClick={() => {
            if (audioRef.current && totalDuration) {
              audioRef.current.currentTime = Math.min(
                audioRef.current.currentTime + 10,
                totalDuration,
              );
            }
          }}
          sx={{
            color: '#94a3b8',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            '&.Mui-disabled': { color: 'rgba(148,163,184,0.3)' },
          }}
        >
          <SkipForward size={18} />
        </IconButton>
      </Box>

      {/* Timeline + waveform */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Waveform visualization */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: '2px', height: 32 }}
        >
          {React.useMemo(
            () =>
              Array.from({ length: 80 }).map(
                (_, i) =>
                  20 +
                  Math.sin(i * 0.4) * 12 +
                  Math.sin(i * 1.2) * 8 +
                  (Math.sin(i * 3.7) * 2 + 2), // deterministic pseudo-random
              ),
            [],
          ).map((h, i) => {
            const filled = isGenerated && (i / 80) * 100 <= progress;
            return (
              <Box
                key={i}
                sx={{
                  width: '2px',
                  height: `${h}%`,
                  borderRadius: '1px',
                  background: filled ? '#90caf9' : 'rgba(148,163,184,0.2)',
                  transition: 'background 0.1s',
                  flexShrink: 0,
                }}
              />
            );
          })}
        </Box>

        {/* Scrub bar */}
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography
            sx={{
              color: '#94a3b8',
              fontSize: '0.6875rem',
              fontFamily: 'monospace',
              minWidth: '35px',
            }}
          >
            {fmt(currentTime)}
          </Typography>
          <Box
            sx={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              position: 'relative',
              cursor: isGenerated ? 'pointer' : 'default',
              background: 'rgba(148,163,184,0.2)',
            }}
            onClick={(e) => {
              if (!isGenerated || !audioRef.current || !totalDuration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              const t = pct * totalDuration;
              audioRef.current.currentTime = t;
              setCurrentTime(t);
              setProgress(pct * 100);
            }}
          >
            <Box
              sx={{
                height: '100%',
                borderRadius: 2,
                width: `${progress}%`,
                background: '#90caf9',
                transition: 'width 0.1s linear',
              }}
            />
          </Box>
          <Typography
            sx={{
              color: '#94a3b8',
              fontSize: '0.6875rem',
              fontFamily: 'monospace',
              minWidth: '35px',
            }}
          >
            {fmt(totalDuration)}
          </Typography>
        </Box>
      </Box>

      {/* Volume & Actions */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          flexShrink: 0,
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          pl: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Volume2 size={18} style={{ color: '#94a3b8' }} />
          <Box
            sx={{
              width: 80,
              height: 4,
              borderRadius: 2,
              position: 'relative',
              cursor: 'pointer',
              background: 'rgba(148,163,184,0.2)',
            }}
            onClick={(e) => {
              if (!audioRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(
                0,
                Math.min(1, (e.clientX - rect.left) / rect.width),
              );
              audioRef.current.volume = pct;
              setVolume(pct);
            }}
          >
            <Box
              sx={{
                height: '100%',
                borderRadius: 2,
                width: `${volume * 100}%`,
                background: '#94a3b8',
              }}
            />
          </Box>
        </Box>

        {(onDownloadStems || onDownloadFull) &&
          (isGenerated || allowDownloads) && (
            <>
              <IconButton
                onClick={(e) => setDownloadAnchorEl(e.currentTarget)}
                title="Download Options"
                sx={{
                  color: '#90caf9',
                  bgcolor: 'rgba(144,202,249,0.1)',
                  borderRadius: 2,
                  '&:hover': { bgcolor: 'rgba(144,202,249,0.2)' },
                }}
              >
                <Download size={18} />
              </IconButton>
              <Menu
                anchorEl={downloadAnchorEl}
                open={Boolean(downloadAnchorEl)}
                onClose={() => setDownloadAnchorEl(null)}
                slotProps={{
                  paper: {
                    sx: {
                      bgcolor: '#1E2433',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                      minWidth: 220,
                    },
                  },
                }}
              >
                {onDownloadFull && (
                  <MenuItem
                    onClick={() => {
                      setDownloadAnchorEl(null);
                      onDownloadFull();
                    }}
                  >
                    <ListItemIcon>
                      <AudioFileOutlinedIcon
                        sx={{ color: '#90caf9' }}
                        fontSize="small"
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary="Download Full Scene"
                      secondary={
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.75rem',
                            display: 'block',
                          }}
                        >
                          Stitched WAV file
                        </Typography>
                      }
                    />
                  </MenuItem>
                )}
                {onDownloadStems && (
                  <MenuItem
                    onClick={() => {
                      setDownloadAnchorEl(null);
                      onDownloadStems();
                    }}
                  >
                    <ListItemIcon>
                      <FolderZipOutlinedIcon
                        sx={{ color: '#90caf9' }}
                        fontSize="small"
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary="Download Stems"
                      secondary={
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.75rem',
                            display: 'block',
                          }}
                        >
                          ZIP of individual files
                        </Typography>
                      }
                    />
                  </MenuItem>
                )}
              </Menu>
            </>
          )}
      </Box>

      {/* Required for the spin animation in Loader2 */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `,
        }}
      />
    </Box>
  );
}
