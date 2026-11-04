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
import { haptic } from '../ui/ios';
import { useTheme } from '../theme/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

function ConversationRow({ conversation, isActive, onPress, onLongPress, theme }) {
  return (
    <TouchableOpacity
      style={[styles.convoRow, isActive && { backgroundColor: theme.accentSoft }]}
      onPress={() => onPress(conversation.id)}
      onLongPress={() => onLongPress?.(conversation)}
    >
      <Text
        style={[styles.convoTitle, { color: theme.textPrimary }]}
        numberOfLines={1}
      >
        {conversation.title || 'New Conversation'}
      </Text>
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
          { backgroundColor: theme.mode === 'dark' ? '#1C1C1E' : '#F2F2F7', transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>Chats</Text>
            <TouchableOpacity onPress={() => { haptic.light(); onNewChat?.(); }} hitSlop={12} accessibilityLabel="New chat">
              <Ionicons name="create-outline" size={24} color={theme.brand} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchField, { backgroundColor: theme.fill }]}>
            <Ionicons name="search" size={16} color={theme.textSecondary} />
            <Text style={[styles.searchText, { color: theme.textSecondary }]}>Search</Text>
          </View>

          <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>Recents</Text>

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

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <View style={styles.userRow}>
              <View style={[styles.avatar, { backgroundColor: theme.brand }]}>
                <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>
                {userName}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { haptic.light(); onOpenSettings?.(); }} hitSlop={12} style={styles.settingsButton} accessibilityLabel="Settings">
              <Ionicons name="settings-outline" size={22} color={theme.brand} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
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
    paddingTop: 10,
    paddingBottom: 6,
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.37,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 6,
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 8,
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
    marginHorizontal: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  convoTitle: {
    fontSize: 17,
    letterSpacing: -0.41,
  },
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
