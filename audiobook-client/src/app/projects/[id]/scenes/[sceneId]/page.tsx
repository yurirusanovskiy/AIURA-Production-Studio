'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Button,
  AppBar,
  Toolbar,
  IconButton,
  List,
  ListItem,
  Divider,
  Avatar,
  Container,
  TextField,
  InputBase,
  Select,
  MenuItem,
  FormControl,
  Tooltip,
  Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutlined';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import SettingsVoiceIcon from '@mui/icons-material/SettingsVoice';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AudioPlayerBar } from '@/components/player/AudioPlayerBar';
import AudioTakeSelector from '@/components/player/AudioTakeSelector';
import {
  sceneService,
  projectService,
  processingService,
  SceneLine,
  Character,
  getAudioUrl,
} from '@/lib/api';
import { notificationService } from '@/lib/notifications';

const scrollbarStyles = {
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: 'rgba(255, 255, 255, 0.3)',
  },
};

const downloadWithSaveDialog = async (
  endpoint: string,
  suggestedName: string,
  mimeType: string,
  extension: string,
  description: string,
) => {
  try {
    if ('showSaveFilePicker' in window) {
      // Ask user where to save the file
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description,
            accept: { [mimeType]: [extension] },
          },
        ],
      });

      // Use proxy to avoid CORS and browser fetch restrictions
      let fetchUrl = endpoint;
      if (fetchUrl.startsWith('http')) {
        fetchUrl = `/api/proxy-audio?url=${encodeURIComponent(endpoint)}`;
      }

      // Fetch the file content
      const response = await fetch(fetchUrl);
      if (!response.ok)
        throw new Error(`Failed to download file (status ${response.status})`);
      const blob = await response.blob();

      // Write it to the chosen location
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      // Fallback for browsers without File System Access API
      // Fetch as blob to force download instead of playing in a new tab
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
      // Fallback if fetch or something else failed
      window.open(endpoint, '_blank');
    }
  }
};

// --- Line Editor Sub-Component ---
const LineEditor = ({
  line,
  idx,
  projectId,
  sceneId,
  characters,
  onChange,
  onSave,
  onAddBelow,
  onDelete,
  onLinesUpdate,
}: {
  line: SceneLine;
  idx: number;
  projectId: string;
  sceneId: string;
  characters: Character[];
  onChange: <K extends keyof SceneLine>(
    index: number,
    field: K,
    value: SceneLine[K],
  ) => void;
  onSave: () => void;
  onAddBelow: () => void;
  onDelete: () => void;
  onLinesUpdate?: (lines: SceneLine[]) => void;
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // If character_id is strictly null, string "null", or empty, map it to 'narrator'
  const charValue =
    !line.character_id || line.character_id === 'null'
      ? 'narrator'
      : line.character_id;

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  const processPhoneticsMutation = useMutation({
    mutationFn: () => processingService.preprocessLines(projectId, [line]),
    onSuccess: (data) => {
      onChange(
        idx,
        'phonetic_text',
        data.processed_lines[0]?.processed_text || line.text,
      );
      onChange(idx, 'is_manual_phonetics', true);
      setTimeout(() => onSave(), 100);
    },
    onError: (error) => {
      console.error('Phonetics processing failed', error);
    },
  });

  const queryClient = useQueryClient();

  const generateLineAudioMutation = useMutation({
    mutationFn: () =>
      sceneService.generateLineAudio(sceneId, line.id as number),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scene', sceneId] });
      onChange(idx, 'audio_url', data.audio_url);
      onChange(idx, 'audio_takes', data.audio_takes);
    },
    onError: (error: Error) => {
      console.error('Line audio generation failed', error);
    },
  });

  const generateChunkAudioMutation = useMutation({
    mutationFn: () =>
      sceneService.generateChunkAudio(sceneId, line.id as number),
    onSuccess: (data) => {
      queryClient.setQueryData(['scene', sceneId], data);
      if (data.lines && onLinesUpdate) {
        onLinesUpdate(data.lines);
      }
    },
    onError: (error: Error) => {
      console.error('Chunk audio generation failed', error);
    },
  });

  const handleToggleManualPhonetics = () => {
    if (line.is_manual_phonetics) {
      onChange(idx, 'is_manual_phonetics', false);
      setTimeout(() => onSave(), 100);
    } else {
      processPhoneticsMutation.mutate();
    }
  };

  return (
    <Box
      sx={{
        bgcolor: '#151A25',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 3,
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}
    >
      {/* Top Row: Character Select & Phonetics Toggle */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ flexGrow: 1 }}>
          <Select
            value={charValue}
            onChange={(e) => {
              onChange(
                idx,
                'character_id',
                e.target.value === 'narrator' ? null : e.target.value,
              );
              setTimeout(() => onSave(), 100);
            }}
            IconComponent={KeyboardArrowDownIcon}
            sx={{
              bgcolor: 'rgba(255,255,255,0.03)',
              color: '#FFF',
              fontWeight: 500,
              fontSize: '0.875rem',
              borderRadius: 2,
              '.MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255,255,255,0.05)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255,255,255,0.1)',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255,255,255,0.2)',
              },
            }}
            MenuProps={{
              slotProps: {
                paper: { sx: { bgcolor: '#1E293B', color: '#FFF' } },
              },
            }}
          >
            <MenuItem value="narrator" sx={{ fontWeight: 500 }}>
              Narrator
            </MenuItem>
            {characters.map((c) => (
              <MenuItem key={c.id} value={c.id} sx={{ fontWeight: 500 }}>
                {c.alias || c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          onClick={handleToggleManualPhonetics}
          disabled={processPhoneticsMutation.isPending}
          sx={{
            bgcolor: line.is_manual_phonetics
              ? 'rgba(244,143,177,0.15)'
              : 'rgba(255,255,255,0.03)',
            color: line.is_manual_phonetics ? '#f48fb1' : '#94A3B8',
            border: `1px solid ${line.is_manual_phonetics ? 'rgba(244,143,177,0.3)' : 'rgba(255,255,255,0.05)'}`,
            fontWeight: 500,
            fontSize: '0.75rem',
            textTransform: 'none',
            borderRadius: 2,
            px: 2,
            py: 1,
            whiteSpace: 'nowrap',
            '&:hover': {
              bgcolor: line.is_manual_phonetics
                ? 'rgba(244,143,177,0.25)'
                : 'rgba(255,255,255,0.08)',
            },
          }}
        >
          {processPhoneticsMutation.isPending ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            'Preprocess Phonetics'
          )}
        </Button>

        <Tooltip title="Add Dialogue Below">
          <IconButton
            onClick={onAddBelow}
            sx={{
              color: '#90caf9',
              bgcolor: 'rgba(144,202,249,0.05)',
              border: '1px solid rgba(144,202,249,0.15)',
              borderRadius: 2,
              '&:hover': {
                bgcolor: 'rgba(144,202,249,0.15)',
              },
            }}
            size="small"
          >
            <AddCircleOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Delete Dialogue Block">
          <IconButton
            onClick={onDelete}
            sx={{
              color: '#f43f5e',
              bgcolor: 'rgba(244,63,94,0.05)',
              border: '1px solid rgba(244,63,94,0.15)',
              borderRadius: 2,
              '&:hover': {
                bgcolor: 'rgba(244,63,94,0.15)',
              },
            }}
            size="small"
          >
            <DeleteOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Text Area (Original or Phonetic based on state) */}
      <Box>
        <Typography
          sx={{
            color: '#94A3B8',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            mb: 1,
          }}
        >
          Original Text
        </Typography>
        <TextField
          multiline
          fullWidth
          value={line.text}
          onChange={(e) => onChange(idx, 'text', e.target.value)}
          onBlur={onSave}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#E2E8F0',
              bgcolor: '#0B1121',
              borderRadius: 2,
              lineHeight: 1.6,
              '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              '&.Mui-focused fieldset': {
                borderColor: 'rgba(255,255,255,0.2)',
              },
            },
          }}
        />
      </Box>

      {/* Phonetic Text Area (Only visible when active) */}
      {line.is_manual_phonetics && (
        <Box>
          <Typography
            sx={{
              color: '#f48fb1',
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              mb: 1,
            }}
          >
            Phonetic Text (ruaccent)
          </Typography>
          <TextField
            multiline
            fullWidth
            value={line.phonetic_text || ''}
            onChange={(e) => onChange(idx, 'phonetic_text', e.target.value)}
            onBlur={onSave}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#f48fb1',
                bgcolor: '#0B1121',
                borderRadius: 2,
                lineHeight: 1.6,
                fontFamily: 'monospace',
                '& fieldset': { borderColor: 'rgba(244,143,177,0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(244,143,177,0.4)' },
                '&.Mui-focused fieldset': { borderColor: '#f48fb1' },
              },
            }}
          />
        </Box>
      )}

      {/* Prompt Override */}
      <Box>
        <Typography
          sx={{
            color: '#94A3B8',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            mb: 1,
          }}
        >
          Prompt Override
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="e.g. Whisper, Dramatic, Slow paced…"
          value={line.prompt_override || ''}
          onChange={(e) => onChange(idx, 'prompt_override', e.target.value)}
          onBlur={onSave}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#E2E8F0',
              bgcolor: '#0B1121',
              borderRadius: 2,
              '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              '&.Mui-focused fieldset': {
                borderColor: 'rgba(255,255,255,0.2)',
              },
            },
          }}
        />
      </Box>

      {/* Line Audio Generation/Playback */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          mt: 1,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {line.id && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              width: '100%',
            }}
          >
            <AudioTakeSelector
              label="Chunk"
              takes={
                line.audio_takes?.filter((t) =>
                  t.audio_url.includes('_chunk_'),
                ) || []
              }
              currentUrl={
                line.audio_url && line.audio_url.includes('_chunk_')
                  ? line.audio_url
                  : null
              }
              onChangeUrl={(url) => {
                onChange(idx, 'audio_url', url);
                setTimeout(() => onSave(), 100);
              }}
              onGenerate={() => generateChunkAudioMutation.mutate()}
              isGenerating={generateChunkAudioMutation.isPending}
              generateText="Generate Chunk"
              generateIcon={<AutoAwesomeIcon fontSize="small" />}
            />

            <AudioTakeSelector
              label="Replica"
              takes={
                line.audio_takes?.filter((t) =>
                  t.audio_url.includes('_replica_'),
                ) || []
              }
              currentUrl={
                line.audio_url && line.audio_url.includes('_replica_')
                  ? line.audio_url
                  : null
              }
              onChangeUrl={(url) => {
                onChange(idx, 'audio_url', url);
                setTimeout(() => onSave(), 100);
              }}
              onGenerate={() => generateLineAudioMutation.mutate()}
              isGenerating={generateLineAudioMutation.isPending}
              generateText="Generate Replica"
              generateIcon={<SettingsVoiceIcon fontSize="small" />}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};
// --- End Line Editor ---

export default function SceneEditorPage() {
  const { id, sceneId } = useParams<{ id: string; sceneId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editedLines, setEditedLines] = useState<SceneLine[]>([]);
  const editedLinesRef = useRef(editedLines);

  const [editedRawText, setEditedRawText] = useState<string>('');
  const initializedRawTextRef = useRef<string | null>(null);
  const initializedLinesRef = useRef<string | null>(null);

  useEffect(() => {
    editedLinesRef.current = editedLines;
  }, [editedLines]);

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectService.getProject(id as string),
    enabled: !!id,
  });

  const { data: projectCharacters } = useQuery({
    queryKey: ['projectCharacters', id],
    queryFn: () => projectService.getProjectCharacters(id as string),
    enabled: !!id,
  });

  const { data: scene, isLoading: sceneLoading } = useQuery({
    queryKey: ['scene', sceneId],
    queryFn: () => sceneService.getScene(sceneId as string),
    enabled: !!sceneId,
  });

  useEffect(() => {
    setEditedLines([]);
    initializedRawTextRef.current = null;
    initializedLinesRef.current = null;
  }, [sceneId]);

  useEffect(() => {
    if (scene && scene.lines && initializedLinesRef.current !== sceneId) {
      setEditedLines(scene.lines);
      initializedLinesRef.current = sceneId;
    }
  }, [scene, sceneId]);

  useEffect(() => {
    if (
      scene &&
      scene.raw_text !== undefined &&
      initializedRawTextRef.current !== sceneId
    ) {
      setEditedRawText(scene.raw_text);
      initializedRawTextRef.current = sceneId;
    }
  }, [scene, sceneId]);

  const extractMutation = useMutation({
    mutationFn: () => sceneService.extractScript(sceneId as string),
    onSuccess: (data) => {
      queryClient.setQueryData(['scene', sceneId], data);
      setEditedLines(data.lines || []);
    },
    onError: (error: Error) => {
      console.error('Extraction failed', error);
    },
  });

  const saveSceneMutation = useMutation({
    mutationFn: (lines: SceneLine[]) =>
      sceneService.updateScene(sceneId as string, { lines }),
    onSuccess: (data) => {
      queryClient.setQueryData(['scene', sceneId], data);
      // Merge newly created database IDs into local editedLines state matching by order_index
      setEditedLines((prev) => {
        return prev.map((line) => {
          if (!line.id) {
            const match = data.lines?.find(
              (l: any) => l.order_index === line.order_index,
            );
            if (match) {
              return { ...line, id: match.id };
            }
          }
          return line;
        });
      });
    },
    onError: (error) => {
      console.error('Save failed', error);
    },
  });

  const saveRawTextMutation = useMutation({
    mutationFn: (raw_text: string) =>
      sceneService.updateScene(sceneId as string, { raw_text }),
    onSuccess: (data) => {
      queryClient.setQueryData(['scene', sceneId], data);
    },
    onError: (error) => {
      console.error('Save raw text failed', error);
    },
  });

  const generateAudioMutation = useMutation({
    mutationFn: () => sceneService.generateAudio(sceneId as string),
    onSuccess: (data) => {
      queryClient.setQueryData(['scene', sceneId], data);
      if (data.lines) {
        setEditedLines(data.lines);
      }
    },
    onError: (error: Error) => {
      console.error('Audio generation failed', error);
    },
  });

  const stitchSceneMutation = useMutation({
    mutationFn: (linesData?: { id: number; audio_url: string | null }[]) =>
      sceneService.stitchScene(sceneId as string, linesData),
    onSuccess: (data) => {
      queryClient.setQueryData(['scene', sceneId], data);
    },
    onError: (error: Error) => {
      console.error('Audio stitching failed', error);
    },
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveRawTextTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const requestSave = useCallback(
    (lines: SceneLine[]) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveSceneMutation.mutate(lines);
      }, 1000);
    },
    [saveSceneMutation],
  );

  const requestSaveRawText = useCallback(
    (rawText: string) => {
      if (saveRawTextTimeoutRef.current) {
        clearTimeout(saveRawTextTimeoutRef.current);
      }
      saveRawTextTimeoutRef.current = setTimeout(() => {
        saveRawTextMutation.mutate(rawText);
      }, 1000);
    },
    [saveRawTextMutation],
  );

  const handleExtract = async () => {
    if (saveRawTextTimeoutRef.current) {
      clearTimeout(saveRawTextTimeoutRef.current);
    }
    if (scene && editedRawText !== scene.raw_text) {
      try {
        await saveRawTextMutation.mutateAsync(editedRawText);
      } catch (err) {
        console.error('Failed to save raw text before extraction:', err);
        notificationService.warning(
          'Failed to save raw text changes. Extraction aborted.',
        );
        return;
      }
    }
    extractMutation.mutate();
  };

  const handleGenerateOrStitch = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      try {
        await saveSceneMutation.mutateAsync(editedLinesRef.current);
      } catch (err) {
        console.error(
          'Failed to save scene lines before generating/stitching:',
          err,
        );
        notificationService.warning(
          'Failed to save dialogue changes. Action aborted.',
        );
        return;
      }
    }

    if (allLinesGenerated) {
      const linesPayload = editedLinesRef.current.map((line) => ({
        id: line.id!,
        audio_url: line.audio_url || null,
      }));
      stitchSceneMutation.mutate(linesPayload);
    } else {
      generateAudioMutation.mutate();
    }
  };

  const handleLineChange = <K extends keyof SceneLine>(
    index: number,
    field: K,
    value: SceneLine[K],
  ) => {
    setEditedLines((prev) => {
      let newLines = [...prev];
      newLines[index] = { ...newLines[index], [field]: value };

      // If we are updating audio_url to a chunk URL, sync other lines in the same chunk
      if (
        field === 'audio_url' &&
        typeof value === 'string' &&
        value.includes('_chunk_')
      ) {
        const filename = value.split('/').pop() || '';
        const match = filename.match(/^(\d+_)/);
        const prefix = match ? match[1] : null;

        if (prefix) {
          newLines = newLines.map((l) => {
            const hasSameChunk = l.audio_takes?.some((t) => {
              const tFilename = t.audio_url.split('/').pop() || '';
              return tFilename.startsWith(prefix);
            });

            if (hasSameChunk) {
              return { ...l, audio_url: value as string };
            }
            return l;
          });
        }
      }

      editedLinesRef.current = newLines;
      return newLines;
    });
  };

  const handleBlurSave = () => {
    requestSave(editedLinesRef.current);
  };

  const handleAddLine = (index: number) => {
    const newLine: SceneLine = {
      scene_id: sceneId as string,
      character_id: null,
      text: '',
      phonetic_text: null,
      is_manual_phonetics: false,
      order_index: index + 1,
    };

    const prev = editedLinesRef.current;
    const newLines = [...prev];
    newLines.splice(index + 1, 0, newLine);
    const remappedLines = newLines.map((line, idx) => ({
      ...line,
      order_index: idx,
    }));

    editedLinesRef.current = remappedLines;
    setEditedLines(remappedLines);
    requestSave(remappedLines);
  };

  const handleDeleteLine = (index: number) => {
    const prev = editedLinesRef.current;
    const newLines = prev.filter((_, idx) => idx !== index);
    const remappedLines = newLines.map((line, idx) => ({
      ...line,
      order_index: idx,
    }));

    editedLinesRef.current = remappedLines;
    setEditedLines(remappedLines);
    requestSave(remappedLines);
  };

  const handleAppendLine = () => {
    const prev = editedLinesRef.current;
    const newLine: SceneLine = {
      scene_id: sceneId as string,
      character_id: null,
      text: '',
      phonetic_text: null,
      is_manual_phonetics: false,
      order_index: prev.length,
    };

    const remappedLines = [...prev, newLine].map((line, idx) => ({
      ...line,
      order_index: idx,
    }));

    editedLinesRef.current = remappedLines;
    setEditedLines(remappedLines);
    requestSave(remappedLines);
  };

  if (sceneLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          bgcolor: '#0B1121',
        }}
      >
        <CircularProgress sx={{ color: '#82B1FF' }} />
      </Box>
    );
  }

  if (!scene) {
    return (
      <Box sx={{ p: 4, bgcolor: '#0B1121', height: '100vh' }}>
        <Typography color="error">Scene not found</Typography>
      </Box>
    );
  }

  const isExtracted =
    scene.status === 'extracted' ||
    scene.status === 'completed' ||
    (scene.lines && scene.lines.length > 0);
  const characters = projectCharacters || [];
  const wordCount = scene.raw_text ? scene.raw_text.split(/\s+/).length : 0;
  const estimatedMinutes = Math.max(1, Math.round(wordCount / 130));

  const allLinesGenerated =
    editedLines.length > 0 && editedLines.every((line) => !!line.audio_url);

  const handleDownload = async (type: 'stems' | 'full') => {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
    const endpoint =
      type === 'stems'
        ? `${backendUrl}/api/v1/scenes/${sceneId}/download-stems`
        : `${backendUrl}/api/v1/scenes/${sceneId}/download-full`;

    const cleanTitle = scene.title
      ? scene.title.replace(/\s+/g, '_')
      : `Scene_${sceneId}`;
    const suggestedName =
      type === 'stems' ? `${cleanTitle}_stems.zip` : `${cleanTitle}.wav`;

    const mimeType = type === 'stems' ? 'application/zip' : 'audio/wav';
    const extension = type === 'stems' ? '.zip' : '.wav';
    const description = type === 'stems' ? 'ZIP Archive' : 'Audio File';

    await downloadWithSaveDialog(
      endpoint,
      suggestedName,
      mimeType,
      extension,
      description,
    );
  };

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        bgcolor: '#0B1121',
      }}
    >
      {/* Topbar */}
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          bgcolor: '#151A25',
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: '64px !important', px: 3 }}>
          <IconButton
            edge="start"
            onClick={() => router.push(`/projects/${id}`)}
            sx={{
              color: '#94A3B8',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: '#94A3B8', fontSize: '0.75rem' }}
            >
              {project?.title || 'Loading project...'}
            </Typography>
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontWeight: 600,
                color: '#FFFFFF',
                fontSize: '1rem',
                lineHeight: 1.2,
              }}
            >
              {scene.title}
            </Typography>
          </Box>
          <Typography sx={{ color: '#94A3B8', fontSize: '0.8125rem' }}>
            {wordCount.toLocaleString()} words · Est. {estimatedMinutes} min
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Main Workspace */}
      <Box
        sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', pb: '88px' }}
      >
        {/* Left Pane: Raw Text */}
        <Box
          sx={{
            width: '42%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <Box
            sx={{
              px: 3,
              py: 2,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              sx={{ color: '#94A3B8', fontSize: '0.8125rem', fontWeight: 500 }}
            >
              Raw Text
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                startIcon={
                  extractMutation.isPending ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <AutoFixHighIcon fontSize="small" />
                  )
                }
                onClick={handleExtract}
                disabled={extractMutation.isPending}
                sx={{
                  background:
                    'linear-gradient(135deg, #90caf9 0%, #a5b4fc 100%)',
                  color: '#0f172a',
                  boxShadow: '0 0 16px rgba(144,202,249,0.3)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 2,
                  py: 0.5,
                  '&:hover': { opacity: 0.9 },
                }}
              >
                {extractMutation.isPending
                  ? 'Extracting...'
                  : 'Extract Script & Roles'}
              </Button>
            </Box>
          </Box>
          <Box
            sx={{
              flexGrow: 1,
              p: 3,
              bgcolor: '#0d1929',
              overflowY: 'auto',
              ...scrollbarStyles,
            }}
          >
            <InputBase
              multiline
              fullWidth
              value={editedRawText}
              onChange={(e) => {
                setEditedRawText(e.target.value);
                requestSaveRawText(e.target.value);
              }}
              onBlur={() => {
                if (saveRawTextTimeoutRef.current) {
                  clearTimeout(saveRawTextTimeoutRef.current);
                }
                if (scene && editedRawText !== scene.raw_text) {
                  saveRawTextMutation.mutate(editedRawText);
                }
              }}
              sx={{
                color: '#FFF',
                fontFamily: 'monospace',
                fontSize: '0.8125rem',
                lineHeight: 1.75,
                padding: 0,
              }}
            />
          </Box>
        </Box>

        {/* Right Pane: Dialogue Editor */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 3,
              py: 2,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              sx={{ color: '#94A3B8', fontSize: '0.8125rem', fontWeight: 500 }}
            >
              Scene & Dialogue Editor
            </Typography>
            <Chip
              label={`${editedLines.length} blocks`}
              size="small"
              sx={{
                bgcolor: 'rgba(144,202,249,0.12)',
                color: '#90caf9',
                fontWeight: 600,
                fontSize: '0.6875rem',
                borderRadius: 1,
              }}
            />
          </Box>

          <Box
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              p: 3,
              pb: 15,
              ...scrollbarStyles,
            }}
          >
            {!isExtracted ? (
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem' }}>
                  Click "Extract Script & Roles" to generate dialogue blocks
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <List
                  sx={{
                    p: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {editedLines.map((line, idx) => (
                    <LineEditor
                      key={line.id || idx}
                      line={line}
                      idx={idx}
                      projectId={id as string}
                      sceneId={sceneId as string}
                      characters={characters}
                      onChange={handleLineChange}
                      onSave={handleBlurSave}
                      onAddBelow={() => handleAddLine(idx)}
                      onDelete={() => handleDeleteLine(idx)}
                      onLinesUpdate={(lines) => {
                        setEditedLines(lines);
                        editedLinesRef.current = lines;
                      }}
                    />
                  ))}
                </List>
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAppendLine}
                  sx={{
                    py: 1.5,
                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                    borderRadius: 3,
                    color: '#94A3B8',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      color: '#FFF',
                    },
                  }}
                >
                  Add Dialogue Line
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Global Audio Player Bar */}
      <AudioPlayerBar
        audioUrl={scene.audio_url ? getAudioUrl(scene.audio_url) : null}
        isGenerating={
          generateAudioMutation.isPending || stitchSceneMutation.isPending
        }
        onGenerate={handleGenerateOrStitch}
        isAllLinesGenerated={allLinesGenerated}
        onDownloadStems={() => handleDownload('stems')}
        onDownloadFull={
          scene.audio_url ? () => handleDownload('full') : undefined
        }
        allowDownloads={
          scene.status === 'error' || scene.status === 'completed'
        }
      />
    </Box>
  );
}
