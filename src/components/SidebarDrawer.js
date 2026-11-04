/**
 * ZAO - Sidebar Drawer
 *
 * Custom-built slide-out drawer using React Native's built-in Animated API -
 * deliberately not react-navigation/drawer or reanimated, to avoid adding
 * more native dependencies after everything we went through getting the
 * Gradle build stable. This is a controlled overlay: `visible` mounts it,
 * an Animated.timing slides it in/out, and onClose is called on backdrop tap
 * or after a swipe-to-close gesture reaches threshold.
 *
 * Layout mirrors the reference: New chat action at top, conversation list
 * in the middle (grouped/scrollable), user row + settings gear pinned at
 * the bottom.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { haptic, CircleButton } from '../ui/ios';
import { useTheme } from '../theme/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

// Grok Bot home-list palette (07): each row gets a colored 40pt avatar.
const ROW_COLORS = ['#1084FE', '#00C972', '#0B0B0B', '#14B8A6', '#8B5E3C', '#FF8A00', '#FF5A5F', '#E83E8C', '#8A8A8D'];

function colorFor(id = '', mode = 'light') {
  let h = 0;
  const key = String(id);
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const c = ROW_COLORS[h % ROW_COLORS.length];
  return mode === 'dark' && c === '#0B0B0B' ? '#3A3A3C' : c;
}

function formatWhen(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts === 'number' ? ts : String(ts).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000);
  if (days <= 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConversationRow({ conversation, isActive, onPress, onLongPress, theme }) {
  const title = conversation.title || 'New Conversation';
  return (
    <TouchableOpacity
      style={[styles.convoRow, isActive && { backgroundColor: theme.glassSelected }]}
      onPress={() => onPress(conversation.id)}
      onLongPress={() => onLongPress?.(conversation)}
    >
      <View style={[styles.rowAvatar, { backgroundColor: colorFor(conversation.id, theme.mode) }]}>
        <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={[styles.convoTitle, { color: theme.textPrimary }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.convoTime, { color: theme.timestamp }]}>{formatWhen(conversation.updated_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SidebarDrawer({
  visible,
  onClose,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onOpenSettings,
  onDeleteConversation,
  userName = 'You',
}) {
  const theme = useTheme();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: visible ? 0 : -DRAWER_WIDTH,
        damping: 26,
        stiffness: 260,
        mass: 1,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  // Swipe-to-close: drag the drawer left past ~40% of its width to dismiss.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dx < -10 && Math.abs(gesture.dy) < 30,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx < 0) {
          translateX.setValue(Math.max(gesture.dx, -DRAWER_WIDTH));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -DRAWER_WIDTH * 0.4) {
          onClose();
        } else {
          Animated.spring(translateX, { toValue: 0, damping: 24, stiffness: 300, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  if (!visible) {
    // Still render nothing when fully closed AND not animating, to avoid
    // eating touch events on the screen behind it. We check the visible
    // prop directly rather than the animated value since Animated.Value
    // isn't safely readable synchronously here.
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawer,
          { backgroundColor: theme.card || (theme.mode === 'dark' ? '#1C1C1E' : '#FFFFFF'), borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.separator, transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* v2: Grok Bot home header - user avatar top-left, white + circle right */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerAvatar, { backgroundColor: theme.glassSelected, borderWidth: 1, borderColor: theme.glassHighlight }]}>
                <Text style={[styles.headerAvatarText, { color: theme.textPrimary }]}>{userName.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>Chats</Text>
            </View>
            <CircleButton theme={theme} icon="add" iconSize={24} label="New chat" onPress={onNewChat} />
          </View>

          <View style={[styles.searchField, { backgroundColor: theme.mode === 'dark' ? '#2C2C2E' : '#F2F2F7', borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator }]}>
            <Ionicons name="search-outline" size={17} color={theme.textSecondary} />
            <Text style={[styles.searchText, { color: theme.textSecondary }]}>Search</Text>
          </View>

          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 12 }}
            renderItem={({ item }) => (
              <ConversationRow
                conversation={item}
                isActive={item.id === activeConversationId}
                onPress={onSelectConversation}
                onLongPress={onDeleteConversation}
                theme={theme}
              />
            )}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
                No conversations yet
              </Text>
            }
          />

          {/* xAI Grok drawer footer: avatar + name bottom-left, gear bottom-right */}
          <View style={[styles.footer, { borderTopColor: theme.separator }]}>
            <View style={styles.userRow}>
              <View style={[styles.avatar, { backgroundColor: theme.bubbleUser }]}>
                <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>
                {userName}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { haptic.light(); onOpenSettings?.(); }} hitSlop={12} style={styles.settingsButton} accessibilityLabel="Settings">
              <Ionicons name="settings-outline" size={22} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  headerAvatarText: { fontSize: 18, fontWeight: '700' },
  brandTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
  },
  searchText: {
    fontSize: 17,
    letterSpacing: -0.41,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 0,
    borderRadius: 999,
  },
  newChatIcon: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  newChatText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.38,
    marginTop: 22,
    marginBottom: 6,
    marginHorizontal: 16,
  },
  list: {
    flex: 1,
  },
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 8,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  rowAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  convoTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  convoTime: { fontSize: 13 },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  settingsButton: {
    padding: 4,
  },
});
