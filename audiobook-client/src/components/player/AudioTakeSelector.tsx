import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  CircularProgress,
  Typography,
} from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutlined';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { SceneLine, LineAudioTake } from '@/lib/api';
import { getAudioUrl } from '@/lib/api';

export const downloadWithSaveDialog = async (
  endpoint: string,
  suggestedName: string,
  mimeType: string,
  extension: string,
  description: string,
) => {
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description,
            accept: { [mimeType]: [extension] },
          },
        ],
      });

      let fetchUrl = endpoint;
      if (fetchUrl.startsWith('http')) {
        fetchUrl = `/api/proxy-audio?url=${encodeURIComponent(endpoint)}`;
      }

      const response = await fetch(fetchUrl);
      if (!response.ok)
        throw new Error(`Failed to download file (status ${response.status})`);
      const blob = await response.blob();

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to download file');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = suggestedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.error('Download failed:', err);
      window.open(endpoint, '_blank');
    }
  }
};

interface AudioTakeSelectorProps {
  label: string;
  takes: LineAudioTake[];
  currentUrl: string | null;
  onChangeUrl: (url: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  generateText: string;
  generateIcon?: React.ReactNode;
}

export default function AudioTakeSelector({
  label,
  takes,
  currentUrl,
  onChangeUrl,
  onGenerate,
  isGenerating,
  generateText,
  generateIcon = <PlayCircleOutlineIcon />,
}: AudioTakeSelectorProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUrl) return;

    let url = getAudioUrl(currentUrl);
    url = url.replace('localhost', '127.0.0.1');

    let suggestedName = `take.wav`;
    try {
      const urlObj = new URL(url, window.location.origin);
      const pathParam = urlObj.searchParams.get('path');
      if (pathParam) {
        suggestedName = pathParam.split('/').pop() || suggestedName;
      } else {
        suggestedName = urlObj.pathname.split('/').pop() || suggestedName;
      }
    } catch (err) {}
    downloadWithSaveDialog(
      url,
      suggestedName,
      'audio/wav',
      '.wav',
      'Audio File',
    );
  };

  const hasAudio = takes.length > 0 || currentUrl;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: 'rgba(255,255,255,0.02)',
        p: 1,
        borderRadius: 2,
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: '#94A3B8', width: 60, flexShrink: 0, fontWeight: 600 }}
      >
        {label}:
      </Typography>

      {hasAudio ? (
        <>
          <audio
            ref={audioRef}
            src={currentUrl ? getAudioUrl(currentUrl) : undefined}
            onEnded={() => setIsPlaying(false)}
            style={{ display: 'none' }}
          />
          <Button
            variant="contained"
            startIcon={
              isPlaying ? <PauseCircleOutlineIcon /> : <PlayCircleOutlineIcon />
            }
            onClick={togglePlay}
            size="small"
            disabled={!currentUrl}
            sx={{
              bgcolor: '#4CAF50',
              color: '#fff',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              minWidth: 80,
              px: 1,
              '&:hover': { bgcolor: '#45a049' },
              '&.Mui-disabled': { bgcolor: 'rgba(76, 175, 80, 0.3)' },
            }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </Button>

          {takes.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={
                  currentUrl
                    ? currentUrl.split('?')[0].split('/').pop() || ''
                    : ''
                }
                onChange={(e) => {
                  const filename = e.target.value as string;
                  const selectedTake = takes.find((t) => {
                    const takeFilename = t.audio_url
                      .split('?')[0]
                      .split('/')
                      .pop();
                    return takeFilename === filename;
                  });
                  if (selectedTake) {
                    onChangeUrl(selectedTake.audio_url);
                  }
                }}
                displayEmpty
                sx={{
                  bgcolor: 'rgba(255,255,255,0.03)',
                  color: '#FFF',
                  fontSize: '0.75rem',
                  height: '32px',
                  borderRadius: 2,
                  '.MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.05)',
                  },
                }}
                MenuProps={{
                  slotProps: {
                    paper: { sx: { bgcolor: '#1E293B', color: '#FFF' } },
                  },
                }}
              >
                {takes.map((take) => {
                  const takeFilename =
                    take.audio_url.split('?')[0].split('/').pop() || '';
                  return (
                    <MenuItem
                      key={take.id}
                      value={takeFilename}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      Take {take.take_number}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          )}

          <Tooltip title="Download Audio">
            <span>
              <IconButton
                size="small"
                onClick={handleDownload}
                disabled={!currentUrl}
                sx={{
                  color: '#94A3B8',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '&:hover': {
                    color: '#FFF',
                    bgcolor: 'rgba(255,255,255,0.08)',
                  },
                }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Regenerate">
            <span>
              <Button
                size="small"
                variant="outlined"
                onClick={onGenerate}
                disabled={isGenerating}
                sx={{
                  color: '#94A3B8',
                  borderColor: 'rgba(255,255,255,0.1)',
                  textTransform: 'none',
                  borderRadius: 2,
                  minWidth: 40,
                  px: 1,
                  '&:hover': {
                    color: '#FFF',
                    borderColor: 'rgba(255,255,255,0.2)',
                  },
                }}
              >
                {isGenerating ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <ReplayIcon fontSize="small" />
                )}
              </Button>
            </span>
          </Tooltip>
        </>
      ) : (
        <Button
          variant="outlined"
          startIcon={
            isGenerating ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              generateIcon
            )
          }
          onClick={onGenerate}
          disabled={isGenerating}
          size="small"
          sx={{
            borderColor: 'rgba(255,255,255,0.1)',
            color: '#94A3B8',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 2,
            '&:hover': {
              borderColor: 'rgba(255,255,255,0.2)',
              color: '#FFF',
            },
          }}
        >
          {isGenerating ? 'Generating...' : generateText}
        </Button>
      )}
    </Box>
  );
}
