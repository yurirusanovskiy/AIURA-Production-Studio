'use client';

import React from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Avatar,
  Tooltip,
} from '@mui/material';
import ClassOutlinedIcon from '@mui/icons-material/ClassOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined';
import HeadphonesOutlinedIcon from '@mui/icons-material/HeadphonesOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const drawerWidth = 88; // Match Figma narrow sidebar

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const menuItems = [
    {
      text: 'Projects',
      icon: <MenuBookOutlinedIcon fontSize="large" />,
      path: '/',
    },
    {
      text: 'Voices',
      icon: <RecordVoiceOverOutlinedIcon fontSize="large" />,
      path: '/voices',
    },
    {
      text: 'Dictionary',
      icon: <ClassOutlinedIcon fontSize="large" />,
      path: '/dictionary',
    },
    {
      text: 'Settings',
      icon: <SettingsOutlinedIcon fontSize="large" />,
      path: '/settings',
    },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 3,
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Avatar
          sx={{
            bgcolor: '#82B1FF', // Primary color
            color: '#151A25', // Background color for contrast
            width: 48,
            height: 48,
            borderRadius: 3, // Slightly rounded square
            mb: 4,
          }}
        >
          <HeadphonesOutlinedIcon fontSize="medium" />
        </Avatar>

        <List sx={{ width: '100%', px: 0 }}>
          {menuItems.map((item) => {
            const isActive =
              pathname === item.path ||
              (item.path !== '/' && pathname.startsWith(item.path));
            return (
              <ListItem
                key={item.text}
                disablePadding
                sx={{
                  mb: 2,
                  display: 'flex',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {isActive && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      height: 32,
                      width: 4,
                      bgcolor: '#82B1FF',
                      borderTopRightRadius: 4,
                      borderBottomRightRadius: 4,
                    }}
                  />
                )}
                <Tooltip title={item.text} placement="right" arrow>
                  <ListItemButton
                    component={Link}
                    href={item.path}
                    sx={{
                      justifyContent: 'center',
                      borderRadius: 2,
                      mx: 2,
                      p: 1.5,
                      bgcolor: isActive
                        ? 'rgba(130, 177, 255, 0.08)'
                        : 'transparent',
                      color: isActive ? '#82B1FF' : '#94A3B8',
                      '&:hover': {
                        bgcolor: 'rgba(130, 177, 255, 0.12)',
                        color: '#82B1FF',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
                      {item.icon}
                    </ListItemIcon>
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
