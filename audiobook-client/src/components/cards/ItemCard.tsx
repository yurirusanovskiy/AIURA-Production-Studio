import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  SxProps,
  Theme,
} from '@mui/material';

export interface ItemCardProps {
  title: string;
  subtitle?: string;

  // Left Avatar/Icon box
  iconNode?: React.ReactNode;
  disableIconBackground?: boolean;

  // Status or Tag Chips
  chips?: { label: string; color?: string; bgcolor?: string }[];

  // Body text
  description?: React.ReactNode;

  // Arbitrary content injected before the bottom actions
  bottomContent?: React.ReactNode;

  // Bottom main action button
  actionButton?: {
    text: string;
    startIcon?: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    disabled?: boolean;
  };

  // Top right actions (e.g. edit, delete, play)
  topRightActions?: React.ReactNode;

  // Card click handler (if the whole card is clickable)
  onClick?: () => void;

  // Container styling overrides
  sx?: SxProps<Theme>;
}

export default function ItemCard({
  title,
  subtitle,
  iconNode,
  chips = [],
  description,
  bottomContent,
  actionButton,
  topRightActions,
  onClick,
  disableIconBackground,
  sx,
}: ItemCardProps) {
  return (
    <Card
      onClick={onClick}
      sx={{
        bgcolor: '#212836',
        borderRadius: 3,
        border: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 200,
        transition: 'all 0.2s ease',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick
          ? {
              bgcolor: 'rgba(33, 40, 54, 0.8)',
              borderColor: '#82B1FF',
              transform: 'translateY(-2px)',
            }
          : {
              borderColor: 'rgba(255,255,255,0.1)',
            },
        ...sx,
      }}
    >
      <CardContent
        sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column' }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: description || chips.length || bottomContent ? 2 : 0,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: iconNode ? 2 : 0,
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            {iconNode && (
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: disableIconBackground ? 0 : '50%', // Usually 50% for voices, maybe pass as prop? Or let parent pass the full node. We'll pass the node inside the circular box.
                  bgcolor: disableIconBackground
                    ? 'transparent'
                    : 'rgba(130, 177, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {iconNode}
              </Box>
            )}
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  color: '#FFFFFF',
                  fontWeight: 600,
                  lineHeight: 1.2,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {title}
              </Typography>
              {subtitle && (
                <Typography
                  variant="caption"
                  sx={{
                    color: '#94A3B8',
                    fontFamily: 'var(--font-geist-mono)',
                    mt: 0.5,
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Box>

          {topRightActions && (
            <Box sx={{ display: 'flex', ml: 2, flexShrink: 0 }}>
              {topRightActions}
            </Box>
          )}
        </Box>

        {chips.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {chips.map((chip) => (
              <Chip
                key={chip.label}
                label={chip.label}
                size="small"
                sx={{
                  bgcolor: chip.bgcolor || 'rgba(255,255,255,0.05)',
                  color: chip.color || '#E2E8F0',
                  borderRadius: 1,
                  fontWeight: 500,
                  textTransform: 'none',
                }}
              />
            ))}
          </Box>
        )}

        {description && (
          <Box sx={{ mb: 'auto' }}>
            {typeof description === 'string' ? (
              <Typography
                variant="body2"
                sx={{
                  color: '#94A3B8',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {description}
              </Typography>
            ) : (
              description
            )}
          </Box>
        )}

        {bottomContent && (
          <Box
            sx={{
              mt: 'auto',
              pt: description || chips.length ? 2 : 0,
              borderTop:
                description && !actionButton && !chips.length
                  ? '1px solid rgba(255,255,255,0.05)'
                  : 'none',
            }}
          >
            {bottomContent}
          </Box>
        )}
      </CardContent>

      {actionButton && (
        <Box
          sx={{
            p: 2,
            pt: 0,
            mt: bottomContent || description || chips.length ? 0 : 'auto',
          }}
        >
          <Button
            fullWidth
            variant="outlined"
            startIcon={actionButton.startIcon}
            onClick={(e) => {
              if (actionButton.onClick) {
                e.stopPropagation();
                actionButton.onClick(e);
              }
            }}
            disabled={actionButton.disabled}
            sx={{
              borderColor: 'rgba(255,255,255,0.1)',
              color: '#FFFFFF',
              py: 1,
              '&:hover': {
                borderColor: '#82B1FF',
                bgcolor: 'rgba(130, 177, 255, 0.05)',
              },
            }}
          >
            {actionButton.text}
          </Button>
        </Box>
      )}
    </Card>
  );
}
