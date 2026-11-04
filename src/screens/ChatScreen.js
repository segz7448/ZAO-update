import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { AppIconTile } from '../ui/icons';
import { Ionicons } from '@expo/vector-icons';
import { CircleButton, ZaoAvatar, AllowButton, DenyButton, GlassFill, glassSurface, haptic } from '../ui/ios';
import DictationWaveform from '../components/DictationWaveform';
import { useDictation } from '../services/dictation/useDictation';
import BrowserCard, { BrowserMiniIndicator } from '../components/BrowserCard';
import { PluginPreviewCard, parsePluginPreview } from '../components/PluginPreviewCard';
import { useComposerDraftStore } from '../store/composerDraftStore';
import { useBrowserCardStore } from '../store/browserCardStore';
import { mergeBrowserCards } from '../services/browserAgent/browserCardState';
import { useChatStore } from '../store/chatStore';
import { usePreferencesStore } from '../store/preferencesStore';
import AttachmentSheet from '../components/AttachmentSheet';
import MarkdownText from '../components/MarkdownText';
import MessageActionMenu from '../components/MessageActionMenu';
import MessageActions from '../components/MessageActions';
import Toast from '../components/Toast';
import ImageViewerModal from '../components/ImageViewerModal';
import ClockWidget from '../components/ClockWidget';
import FileArtifactCard from '../components/FileArtifactCard';
import SentAttachmentCard from '../components/SentAttachmentCard';
import { ACTIVE_MODEL } from '../config/localModels';
import { useTheme } from '../theme/useTheme';
import { REASONING_STRATEGY_LABELS, REASONING_STRATEGY_GLYPHS } from '../services/reasoning/reasoningTypes';

// Long-press threshold per spec: 400-500ms. 450ms sits in the middle of
// that range - long enough to not fire on a slightly slow tap, short
// enough to still feel responsive. Long-press now only applies to user
// bubbles (Copy/Edit) - assistant replies use the always-visible inline
// action row below instead (see MessageActions.js).
const LONG_PRESS_DURATION_MS = 450;

/** Safely turns messages.clock_data (stored as JSON text - see src/db/database.js's migration comment) back into { timezone, label }, never throwing on malformed/legacy data. */
function parseClockData(rawClockData) {
  if (!rawClockData) return null;
  try {
    return JSON.parse(rawClockData);
  } catch (err) {
    return null;
  }
}

/** Safely turns messages.reasoning_trace (stored as JSON text - see src/db/database.js's migration comment) back into a plain object/string, never throwing on malformed or legacy data. */
function parseReasoningTrace(rawTrace) {
  if (!rawTrace) return null;
  if (typeof rawTrace !== 'string') return rawTrace;
  try {
    return JSON.parse(rawTrace);
  } catch (err) {
    return rawTrace; // plain string trace (chainOfThought.js / inferenceModes.js's <thinking> text) stored as-is
  }
}

/** Safely turns messages.pending_confirmation (stored as JSON text - see src/db/database.js's migration comment) back into { toolName, args, reason }, never throwing on malformed/legacy data. */
function parsePendingConfirmation(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

/** Safely turns messages.artifacts (stored as JSON text - see src/db/database.js's migration comment) back into an array of {path, toolName}, never throwing on malformed/legacy data. */
function parseArtifacts(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch (err) {
    return null;
  }
}

/** Renders a parsed reasoning trace (string or the shape treeOfThought.js/selfReflection.js produce) as readable plain text for the expandable trace box. */
function formatReasoningTrace(trace) {
  if (!trace) return null;
  if (typeof trace === 'string') return trace;

  const parts = [];
  if (Array.isArray(trace.branches)) {
    trace.branches.forEach((b, i) => {
      const marker = i === trace.chosenIndex ? '✓ ' : '';
      parts.push(`${marker}${b.approach}\n${b.reasoning}`);
    });
    if (trace.whyBest) parts.push(`Chosen because: ${trace.whyBest}`);
  }
  if (trace.thinking) parts.push(trace.thinking);
  if (trace.selfReflection?.issues?.length) {
    parts.push(`Self-check found: ${trace.selfReflection.issues.join('; ')} — revised.`);
  }
  if (trace.note) parts.push(trace.note);
  return parts.length ? parts.join('\n\n') : null;
}

/** Small "🧠 Tree of thought" style chip under an assistant bubble - tap to expand/collapse the reasoning trace, if one was recorded (see src/db/database.js's reasoning_type/reasoning_trace migration). */
function ReasoningChip({ reasoningType, reasoningTrace, theme }) {
  const [expanded, setExpanded] = useState(false);
  if (!reasoningType || !REASONING_STRATEGY_LABELS[reasoningType]) return null;

  const trace = parseReasoningTrace(reasoningTrace);
  const traceText = formatReasoningTrace(trace);
  const label = REASONING_STRATEGY_LABELS[reasoningType];
  const glyph = REASONING_STRATEGY_GLYPHS[reasoningType] || '';

  return (
    <>
      <TouchableOpacity
        onPress={() => traceText && setExpanded((v) => !v)}
        style={[styles.reasoningChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
        activeOpacity={traceText ? 0.7 : 1}
      >
        <Text style={[styles.reasoningChipText, { color: theme.textSecondary }]}>{glyph} {label}</Text>
        {!!traceText && (
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={theme.textTertiary} />
        )}
      </TouchableOpacity>
      {expanded && !!traceText && (
        <View style={[styles.reasoningTraceBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Text style={[styles.reasoningTraceText, { color: theme.textSecondary }]}>{traceText}</Text>
        </View>
      )}
    </>
  );
}

/**
 * Human-readable one-line preview of what a non-terminal tool call would
 * do, built from its raw args - there's no single "command" field to
 * show the way there is for terminal calls, so this picks the most
 * relevant identifying field per tool family instead of dumping raw JSON
 * at the person.
 */
function describePendingToolArgs(toolName, args) {
  if (!args) return null;
  if (toolName?.startsWith('github_')) {
    const target = [args.owner, args.repo].filter(Boolean).join('/');
    if (toolName === 'github_commit_files' && Array.isArray(args.files)) {
      return `${target}: commit ${args.files.length} file${args.files.length === 1 ? '' : 's'}${args.branch ? ` to ${args.branch}` : ''}`;
    }
    if (toolName === 'github_create_pull_request') return `${target}: open PR "${args.title || ''}" (${args.head} → ${args.base || 'main'})`;
    return target || args.name || null;
  }
  if (toolName?.startsWith('fs_')) return args.path || args.name || null;
  if (toolName?.startsWith('pdf_') || toolName?.startsWith('docx_') || toolName?.startsWith('xlsx_') || toolName?.startsWith('pptx_') || toolName === 'csv_create') {
    return args.path || args.fileName || args.title || null;
  }
  return null;
}

function PendingToolConfirmCard({ pendingConfirmation, onApprove, onDismiss, theme }) {
  const [busy, setBusy] = useState(false);
  const parsed = parsePendingConfirmation(pendingConfirmation);
  if (!parsed?.toolName) return null;

  const isTerminal = parsed.toolName === 'terminal_pc_run_command' || parsed.toolName === 'pc_process_start';
  const detail = isTerminal ? parsed.args?.command : describePendingToolArgs(parsed.toolName, parsed.args);

  const handleApprove = async () => {
    setBusy(true);
    await onApprove();
    setBusy(false);
  };

  return (
    <View style={[styles.confirmCard, glassSurface(theme, 20)]}>
      <GlassFill theme={theme} radius={20} strong />
      <View style={styles.confirmCardHeader}>
        <AppIconTile k={parsed.toolName} size={22} />
        <Text style={[styles.confirmCardTitle, { color: theme.textPrimary }]}>Needs your approval</Text>
      </View>
      <Text style={[styles.confirmCardReason, { color: theme.textSecondary }]}>
        {parsed.reason || 'This action is irreversible or makes a change and needs confirmation.'}
      </Text>
      {!!detail && (
        <View style={[styles.confirmCardCommandBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Text style={[styles.confirmCardCommandText, { color: theme.textPrimary }]} numberOfLines={4}>
            {detail}
          </Text>
        </View>
      )}
      {isTerminal && (
        <Text style={[styles.confirmCardBackend, { color: theme.textTertiary }]}>
          Would run on: PC
        </Text>
      )}
      <View style={styles.confirmCardActions}>
        <DenyButton
          theme={theme}
          onPress={() => { haptic.warning(); onDismiss?.(); }}
          disabled={busy}
        />
        <AllowButton
          label={busy ? 'Working…' : `Allow${isTerminal ? ' & run' : ''}`}
          onPress={() => { haptic.success(); handleApprove(); }}
          disabled={busy}
        />
      </View>
    </View>
  );
}

function MessageBubble({ message, theme, onLongPress, onImagePress, actionsProps, onOpenPlan, onApproveCommand, onDismissCommand, onToast, onGoChat, onRetryError }) {
  const isUser = message.role === 'user';
  const textColor = isUser ? theme.bubbleUserText : theme.bubbleAssistantText;
  const bubbleRef = useRef(null);

  const handleLongPress = () => {
    // Measure the bubble's on-screen position at the moment of the press
    // (not on mount) so the anchor is accurate even after scrolling.
    bubbleRef.current?.measureInWindow((x, y, width, height) => {
      onLongPress(message, { x, y, width, height });
    });
  };

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
      <View style={isUser ? styles.bubbleColUser : styles.bubbleColAssistant}>
        <TouchableOpacity
          ref={bubbleRef}
          activeOpacity={0.85}
          delayLongPress={LONG_PRESS_DURATION_MS}
          onLongPress={isUser ? handleLongPress : undefined}
          style={[
            styles.bubble,
            isUser
              ? { backgroundColor: theme.userBubbleGlass, borderWidth: 1, borderColor: theme.userBubbleHighlight }
              : theme.assistantUsesBubble
                ? glassSurface(theme, 18)
                : styles.bubblePlainAssistant,
            message.is_error && {
              backgroundColor: theme.dangerSoft,
              borderWidth: 1,
              borderColor: theme.dangerBorder,
            },
            (message.local_image_path || message.local_attachment_path) && styles.bubbleImagePadding,
          ]}
        >
          {!isUser && theme.assistantUsesBubble && !message.is_error && <GlassFill theme={theme} radius={18} />}
          {message.local_image_path && (
            // Image bubble - the person's own attached photo (see
            // copyAttachmentLocally in chatStore.js), stored as a local
            // file:// URI. Tapping opens the full-screen viewer with a
            // download-to-gallery action (see ImageViewerModal.js).
            <TouchableOpacity activeOpacity={0.9} onPress={() => onImagePress?.(message.local_image_path)}>
              <Image
                source={{ uri: message.local_image_path }}
                style={styles.generatedImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
          {message.local_attachment_path && (
            // Video/generic-file bubble - see SentAttachmentCard.js's
            // header for why this is a tappable card rather than an
            // inline player/preview.
            <SentAttachmentCard
              localPath={message.local_attachment_path}
              kind={message.attachment_kind}
              name={message.attachment_name}
              theme={theme}
              onToast={onToast}
            />
          )}
          {isUser ? (
            // User messages are rendered as plain text - no reason to parse
            // markdown out of what the person typed themselves. Skipped
            // entirely for image-only sends (no caption typed), same as
            // the assistant's image-only case below.
            !!message.content && (
              <Text
                style={[
                  { color: textColor, fontSize: 16, lineHeight: 21, letterSpacing: -0.32 },
                  (message.local_image_path || message.local_attachment_path) && styles.bubbleTextAfterImage,
                ]}
              >
                {message.content}
              </Text>
            )
          ) : message.local_image_path ? null : (
            <MarkdownText
              content={message.content}
              textColor={message.is_error ? theme.dangerText : textColor}
              codeBackground={theme.mode === 'dark' ? '#0D0D0D' : '#00000010'}
              codeTextColor={textColor}
              borderColor={theme.borderStrong}
            />
          )}
          {!isUser && message.is_error ? (
            <TouchableOpacity
              onPress={() => { haptic.light(); onRetryError?.(message); }}
              style={{ marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: theme.mode === 'dark' ? '#2C2C2E' : '#E5E5EA' }}
              accessibilityRole="button"
              accessibilityLabel="Retry"
            >
              <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }} maxFontSizeMultiplier={1.2}>Retry</Text>
            </TouchableOpacity>
          ) : null}
          {!isUser && message.plugin_preview ? (
            <View style={{ marginTop: 10 }}>
              <PluginPreviewCard
                preview={parsePluginPreview(message.plugin_preview)}
                theme={theme}
                onGoChat={onGoChat}
              />
            </View>
          ) : null}
          <View style={styles.bubbleFooter}>
            {!isUser && message.model_family && !message.is_error && (
              <Text style={[styles.modelTag, { color: theme.textTertiary }]}>
                {ACTIVE_MODEL.label}
              </Text>
            )}
            {isUser && message.edited_at && (
              <Text style={[styles.editedTag, { color: theme.bubbleUserText }]}>
                Edited
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Set only on the one reply that came from the hierarchical
            planning system (src/services/brain/backendBrain.js's
            runHierarchicalPlan) - opens PlanScreen.js at this plan so the
            person can see/approve/track the actual steps instead of just
            reading the chat summary. See src/db/database.js's messages
            migration comment for plan_id. */}
        {!isUser && !message.is_error && !!message.plan_id && (
          <TouchableOpacity
            onPress={() => onOpenPlan?.(message.plan_id)}
            style={[styles.viewPlanChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="list-outline" size={14} color={theme.textPrimary} />
            <Text style={[styles.viewPlanChipText, { color: theme.textPrimary }]}>View Plan</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
          </TouchableOpacity>
        )}

        {/* Set only on a reply that came from a time_get_current tool
            call (src/services/toolOrchestrator.js) - renders a live,
            second-by-second digital + analog clock instead of a static
            time the person read once and which is already stale. See
            src/db/database.js's messages migration comment for
            clock_data. */}
        {!isUser && !message.is_error && !!message.clock_data && (() => {
          const clock = parseClockData(message.clock_data);
          return clock ? (
            <ClockWidget timezone={clock.timezone} label={clock.label} theme={theme} />
          ) : null;
        })()}

        {!isUser && !message.is_error && !!message.reasoning_type && (
          <ReasoningChip reasoningType={message.reasoning_type} reasoningTrace={message.reasoning_trace} theme={theme} />
        )}

        {/* Set on a reply where ANY confirmable tool call was refused
            (a RISKY terminal command per commandSafety.js, or a
            WRITE_TOOL/DESTRUCTIVE_TOOL - GitHub, filesystem, PDF, Office -
            in 'default'/'acceptEdits' mode per permissionModes.js) - the
            flat tool loop's human-in-the-loop gate (see
            SYSTEM_COMPONENTS.md / HARDENING_NOTES.md). Approve re-invokes
            the exact call (terminal commands with confirmed: true; every
            other tool directly); Dismiss just clears it. */}
        {!isUser && !message.is_error && !!message.pending_confirmation && (
          <PendingToolConfirmCard
            pendingConfirmation={message.pending_confirmation}
            onApprove={() => onApproveCommand?.(message.id)}
            onDismiss={() => onDismissCommand?.(message.id)}
            theme={theme}
          />
        )}

        {/* Set on a reply where a plan the person approved and ran
            actually created real file(s) on the PC backend - see
            src/db/database.js's artifacts migration comment and
            planStore.js's postArtifactsMessageIfAny. Each row's own
            Download tap pulls that file from the PC into the phone's
            SAF-granted folder (Settings > Filesystem) - see
            FileArtifactCard.js's header for why that's a separate step
            from the file merely existing on the PC. */}
        {!isUser && !message.is_error && !!message.artifacts && (() => {
          const artifacts = parseArtifacts(message.artifacts);
          return artifacts ? (
            <FileArtifactCard
              artifacts={artifacts}
              theme={theme}
              onToast={onToast}
            />
          ) : null;
        })()}

        {/* Always-visible inline action row under assistant replies (not
            errors - regenerating/liking/reading a plain error message
            doesn't make sense). See MessageActions.js. */}
        {!isUser && !message.is_error && (
          <MessageActions message={message} {...actionsProps} />
        )}
      </View>
    </View>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Turns one raw AgentStep (from the Browser Router backend - see
 * browser-router/app/agent.py's AgentStep) into a short, friendly label
 * for the live typing-indicator area, e.g. "Searching..." or "Opening
 * github.com...". Falls back to a generic label for step kinds/tool names
 * this hasn't been taught a friendly phrasing for, rather than showing the
 * raw backend detail string (which is deliberately verbose/technical -
 * useful for debugging, not for a live progress UI).
 */
function formatBrowsingStepLabel(stepInfo) {
  if (!stepInfo?.action) return 'Browsing…';
  const { action } = stepInfo;

  switch (action.action) {
    case 'navigate': {
      try {
        return `Opening ${new URL(action.url).hostname.replace('www.', '')}…`;
      } catch (e) {
        return 'Opening page…';
      }
    }
    case 'click': return 'Clicking…';
    case 'fill': return 'Typing…';
    case 'selectOption': return 'Selecting an option…';
    case 'setChecked': return 'Toggling a checkbox…';
    case 'submitForm': return 'Submitting…';
    case 'scrollTo': return 'Scrolling…';
    case 'waitForSelector': return 'Waiting for the page…';
    case 'extractPageText': return 'Reading the page…';
    case 'extractTables': return 'Reading a table…';
    case 'newTab': return 'Opening a new tab…';
    case 'switchTab': return 'Switching tabs…';
    case 'closeTab': return 'Closing a tab…';
    case 'goBack': return 'Going back…';
    case 'download': return 'Downloading a file…';
    case 'needsHuman': return 'Needs your input…';
    case 'finish': return 'Wrapping up…';
    default: return 'Browsing…';
  }
}

export default function ChatScreen({ onOpenSidebar, onOpenPlan, onOpenBrowser, onTakeOverBrowser, browserStream = null, onNewChat, browserAgentActive = false, userName = '', activeMode = 'chat' }) {
  const theme = useTheme();
  // Inline browser cards (browserCardStore, fed by App's one BrowserAgentStream).
  const browserCards = useBrowserCardStore((s) => s.cards);
  const activeBrowserCardId = useBrowserCardStore((s) => s.activeCardId);
  const toggleBrowserCard = useBrowserCardStore((s) => s.toggleCollapsed);
  const dispatchBrowserCard = useBrowserCardStore((s) => s.dispatch);
  const chatConversationId = useChatStore((s) => s.conversationId);
  const [browserCardVisible, setBrowserCardVisible] = useState(true);
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const id = useBrowserCardStore.getState().activeCardId;
    setBrowserCardVisible(!id || viewableItems.some((v) => v.item?.id === id));
  }).current;

  const {
    messages, isSending, error, stopCurrentRun,
    browsingSteps, planProgress, planSteps, streamingText, streamingThinking,
    sendMessage, clearError, editMessage,
    regenerateMessage, setFeedback,
    approvePendingToolCall, dismissPendingConfirmation,
  } = useChatStore();
  const { preferences, loadPreferences, setBrowserAccessEnabled, setWebSearchEnabled, setGithubToolsEnabled, apiKeyStatus } = usePreferencesStore();

  const [inputText, setInputText] = useState('');
  // Starter prompts from Plugins hub / PluginPreviewCard Edit land here.
  useEffect(() => {
    const pull = () => {
      const draft = useComposerDraftStore.getState().consumeDraft();
      if (draft) setInputText(draft);
    };
    pull();
    return useComposerDraftStore.subscribe((state, prev) => {
      if (state.draft && state.draft !== prev?.draft) pull();
    });
  }, []);
  const [attachmentVisible, setAttachmentVisible] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null); // { uri, name, mimeType, size }
  const listRef = useRef(null);
  const listData = React.useMemo(() => mergeBrowserCards(messages, browserCards, chatConversationId), [messages, browserCards, chatConversationId]);
  const activeBrowserCard = browserCards.find((c) => c.id === activeBrowserCardId && c.conversationId === chatConversationId);
  const showBrowserMini = !!activeBrowserCard && !browserCardVisible && ['working', 'paused', 'live', 'reconnecting'].includes(activeBrowserCard.phase);
  const scrollToBrowserCard = () => {
    const index = listData.findIndex((x) => x.id === activeBrowserCardId);
    if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0.2, animated: true });
  };

  // Persisted (see database.js's web_search_enabled/github_tools_enabled
  // migration) - these used to be local useState and silently reset to
  // off on every app restart regardless of what the person last set.
  const webSearchEnabled = !!preferences.web_search_enabled;
  const githubToolsEnabled = !!preferences.github_tools_enabled;
  const githubConfigured = !!preferences.github_username && !!apiKeyStatus?.github?.configured;

  // Long-press message action menu - user messages only now (Copy/Edit,
  // see MessageActionMenu.js). Assistant replies use the always-visible
  // inline MessageActions row instead. activeMessage + anchor together
  // drive the overlay; editingMessageId swaps the composer into "Save" mode.
  const [activeMessage, setActiveMessage] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [viewerImageUri, setViewerImageUri] = useState(null);
  const toastRef = useRef(null);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Inline assistant-message action state: which message (if any) is
  // currently being regenerated, keyed by message id so the row only shows
  // a spinner on the one that's actually busy, not every bubble.
  const [regeneratingMessageId, setRegeneratingMessageId] = useState(null);

  const handleBubbleLongPress = (message, anchor) => {
    setActiveMessage(message);
    setMenuAnchor(anchor);
  };

  const closeActionMenu = () => {
    setActiveMessage(null);
    setMenuAnchor(null);
  };

  const handleEditRequest = (message) => {
    // Pull the message back into the composer, cursor at the end (default
    // TextInput behavior when setting value programmatically), swap Send
    // for Save. The message stays in the list underneath - visually there
    // isn't a way for a user message list item to be removed and re-added
    // as they type without odd flicker, so instead it's just no longer
    // sent again on Save; editMessage() updates it in place by id, then
    // deletes everything after it and asks the AI to respond again.
    setInputText(message.content || '');
    setEditingMessageId(message.id);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setInputText('');
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId) return;
    const trimmed = inputText.trim();
    if (!trimmed) return;
    // editMessage() saves the new content, deletes everything after this
    // message, and re-runs the AI on the truncated conversation - the
    // composer clears immediately, isSending (from the store) drives the
    // "Thinking…" indicator while the fresh reply comes back.
    setEditingMessageId(null);
    setInputText('');
    const result = await editMessage(editingMessageId, trimmed);
    if (!result.success) {
      Alert.alert('Could not save edit', 'Please try again.');
    }
  };

  const handleLikeMessage = (message) => setFeedback(message.id, 'like');
  const handleDislikeMessage = (message) => setFeedback(message.id, 'dislike');

  const handleRegenerateMessage = async (message) => {
    setRegeneratingMessageId(message.id);
    try {
      const result = await regenerateMessage(message.id);
      if (!result.success) {
        Alert.alert('Could not regenerate', 'Please try again.');
      }
    } finally {
      setRegeneratingMessageId(null);
    }
  };

  // Composer action-button state machine: voice mode (mic + black voice
  // button) when the input is empty, send mode (orange send button) as
  // soon as any text is present. Driven by a single Animated value so the
  // two states cross-fade/scale instead of ever being visible together.
  const hasText = inputText.trim().length > 0 || !!pendingAttachment;
  const composerAnim = useRef(new Animated.Value(0)).current; // 0 = voice mode, 1 = send mode

  useEffect(() => {
    Animated.timing(composerAnim, {
      toValue: hasText ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [hasText]);

  useEffect(() => {
    loadPreferences();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  // Grok-style mic dictation (expo-speech-recognition). Needs a native rebuild
  // after adding the config plugin — Expo Go / stale binaries get a friendly alert.
  const dictationCommitRef = useRef(null);
  const { state: dictationState, liveText, isRecording, start: startDictation, stop: stopDictation } = useDictation({
    onCommit: (text, meta = {}) => {
      dictationCommitRef.current?.(text, meta);
    },
  });
  dictationCommitRef.current = async (text, { send } = {}) => {
    const trimmed = String(text || '').trim();
    if (send) {
      if (!trimmed && !pendingAttachment) {
        setInputText(text || '');
        return;
      }
      setInputText('');
      await sendMessage(trimmed, pendingAttachment, { webSearchEnabled, githubToolsEnabled, browserAgentActive });
      setPendingAttachment(null);
      return;
    }
    setInputText(text || '');
  };

  const handleSend = async () => {
    // Send while recording: stop recognition, then send the committed transcript.
    if (isRecording) {
      stopDictation({ andSend: true });
      return;
    }
    const empty = !inputText.trim() && !pendingAttachment;
    // Empty + working → Stop (scoped to this run only). Typing morphs back to Send.
    if (empty && isSending) {
      haptic.warning();
      stopCurrentRun();
      return;
    }
    if (empty) return;
    const text = inputText;
    const attachment = pendingAttachment;
    setInputText('');
    setPendingAttachment(null);
    await sendMessage(text, attachment, { webSearchEnabled, githubToolsEnabled, browserAgentActive });
  };

  const handleCamera = async () => {
    setAttachmentVisible(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Enable camera access in your phone settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setPendingAttachment({
        uri: asset.uri,
        name: asset.fileName || `photo_${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
        size: asset.fileSize,
      });
    }
  };

  const handlePhotos = async () => {
    setAttachmentVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Enable photo library access in your phone settings to attach an image or video.');
      return;
    }
    // MediaTypeOptions.All (rather than just Images) - Ox Alpha has real
    // video understanding now (see chatStore.js's buildMultimodalContent
    // and fileProcessor.js's processVideo), so the library picker can
    // offer videos too, not just photos.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      setPendingAttachment({
        uri: asset.uri,
        name: asset.fileName || `${isVideo ? 'video' : 'image'}_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        size: asset.fileSize,
      });
    }
  };

  const handleFiles = async () => {
    setAttachmentVisible(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setPendingAttachment({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
        size: asset.size,
      });
    }
  };

  // Muse-style gray status line under the header name while ZAO is working.
  const headerStatus = !isSending
    ? null
    : streamingText
      ? 'Writing…'
      : planSteps.length > 0
        ? `Running plan · step ${planSteps.length}`
        : planProgress
          ? 'Planning…'
          : browsingSteps.length > 0
            ? 'Browsing…'
            : 'Thinking…';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: 'transparent' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* v2 header: Grok Bot 44pt white circles + avatar/name pill, merged with
          Muse's centered avatar and gray working-status line. */}
      <View style={[styles.header, { backgroundColor: 'transparent', minHeight: headerStatus ? 74 : 56 }]}>
        <CircleButton theme={theme} icon="menu-outline" label="Open menu" onPress={onOpenSidebar} />
        <View style={styles.headerCenter} pointerEvents="none">
          <View style={[styles.identityPill, glassSurface(theme, 22)]}>
            <GlassFill theme={theme} radius={22} strong />
            <ZaoAvatar size={28} />
            <Text style={[styles.identityName, { color: theme.textPrimary }]}>ZAO</Text>
          </View>
          {!!headerStatus && (
            <Text style={[styles.identityStatus, { color: theme.textSecondary }]} numberOfLines={1}>
              {headerStatus}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <CircleButton
            theme={theme}
            icon="desktop-outline"
            iconSize={20}
            label="Open the browser"
            onPress={onOpenBrowser}
            style={browserAgentActive ? { borderWidth: 1.5, borderColor: theme.brand } : null}
          />
          <CircleButton theme={theme} icon="create-outline" iconSize={20} label="New chat" onPress={onNewChat} />
        </View>
      </View>

      {/* xAI Grok-style centered text tabs (active bold, inactive gray) */}
      <View style={styles.modeTabsRow}>
      <View style={[styles.modeTabs, glassSurface(theme, 999)]}>
        <GlassFill theme={theme} radius={999} />
        {[
          { key: 'chat', label: 'Chat' },
          { key: 'plan', label: 'Plan' },
        ].map((mode) => {
          const selected = activeMode === mode.key;
          return (
            <TouchableOpacity
              key={mode.key}
              style={[styles.modeTab, selected && { backgroundColor: theme.glassSelected }]}
              onPress={() => {
                haptic.select();
                if (mode.key === 'chat') return;
                if (mode.key === 'plan') onOpenPlan?.(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={mode.label}
            >
              <Text style={[styles.modeTabText, { color: selected ? theme.textPrimary : theme.textSecondary, fontWeight: selected ? '600' : '500' }]}>
                {mode.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      </View>

      {error && (
        <TouchableOpacity
          style={[styles.errorBanner, { backgroundColor: theme.dangerSoft }]}
          onPress={clearError}
        >
          <Text style={[styles.errorBannerText, { color: theme.dangerText }]}>{error}</Text>
        </TouchableOpacity>
      )}

      <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={listData}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 20 }}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item }) => item.__browserCard ? (
          <BrowserCard
            card={item.card}
            theme={theme}
            stream={browserStream}
            onExpand={onOpenBrowser}
            onTakeOver={onTakeOverBrowser}
            onToggleCollapsed={() => toggleBrowserCard(item.card.id)}
            onStopRequested={() => dispatchBrowserCard({ type: 'stopRequested' })}
          />
        ) : (
          <MessageBubble
            message={item}
            theme={theme}
            onLongPress={handleBubbleLongPress}
            onImagePress={setViewerImageUri}
            onOpenPlan={onOpenPlan}
            onApproveCommand={approvePendingToolCall}
            onDismissCommand={dismissPendingConfirmation}
            onToast={(text) => toastRef.current?.show(text)}
            actionsProps={{
              onCopyToast: (text) => toastRef.current?.show(text),
              onLike: handleLikeMessage,
              onDislike: handleDislikeMessage,
              onRegenerate: handleRegenerateMessage,
              isRegenerating: regeneratingMessageId === item.id,
            }}
          onRetryError={(msg) => { regenerateMessage?.(msg.id); }}
          />
        )}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyGlyph, { borderColor: theme.borderStrong }]}>
              <Ionicons name="flash-outline" size={28} color={theme.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              {userName ? `${getGreeting()}, ${userName}` : getGreeting()}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
              Ask anything
            </Text>
            <View style={styles.emptyChips}>
              {[
                { label: 'Plan a task', fill: 'chipBlue', icon: 'list-outline' },
                { label: 'Browse the web', fill: 'chipGrey', icon: 'globe-outline' },
                { label: 'Write code', fill: 'chipGrey', icon: 'code-slash-outline' },
              ].map((chip) => (
                <TouchableOpacity
                  key={chip.label}
                  style={[styles.emptyChip, { backgroundColor: theme[chip.fill] || theme.surfaceAlt }]}
                  onPress={() => setInputText(chip.label)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={chip.icon} size={14} color={chip.fill === 'chipBlue' ? theme.brand : theme.textPrimary} />
                  <Text style={[styles.emptyChipText, { color: chip.fill === 'chipBlue' ? theme.brand : theme.textPrimary }]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
      />
      {showBrowserMini && <BrowserMiniIndicator card={activeBrowserCard} theme={theme} onPress={scrollToBrowserCard} />}
      </View>

      {isSending && (
        <View style={styles.typingIndicator}>
          {streamingText ? (
            // The CHAT route's reply streaming in token-by-token (see
            // chatStore.js's onToken / backendClient.js's sendMessage).
            // Unlike the step-label branches below this shows the actual
            // in-progress answer text, so no numberOfLines truncation.
            <View style={styles.browsingProgress}>
              <Text style={[styles.typingText, { color: theme.textPrimary }]}>
                {streamingText}
              </Text>
            </View>
          ) : streamingThinking ? (
            // The model is still inside <thinking> - stream its raw reasoning
            // live instead of a bare "Thinking…" spinner (see chainOfThought.js's
            // onThinking / extractStreamingThinking()). Swaps over to the
            // streamingText branch above the moment <answer> opens. Italicized
            // and dimmer than the real answer so it visually reads as
            // in-progress/draft, same idea as Claude's collapsed thinking view.
            <View style={styles.browsingProgress}>
              <Text
                style={[styles.typingText, { color: theme.textTertiary, fontStyle: 'italic' }]}
                numberOfLines={2}
              >
                {streamingThinking.length > 220 ? `…${streamingThinking.slice(-220)}` : streamingThinking}
              </Text>
            </View>
          ) : planSteps.length > 0 || planProgress ? (
            // Live hierarchical-plan progress - a real checklist instead
            // of a bare spinner while a plan builds (planProgress) or runs
            // (planSteps). Previously onPlanProgress/onPlanStep were wired
            // through orchestrator.js with no handler on the chatStore end,
            // so this branch never had anything to show - see
            // SYSTEM_COMPONENTS.md's state-management section.
            <View style={styles.browsingProgress}>
              <ActivityIndicator size="small" color={theme.textTertiary} />
              <Text
                style={[styles.typingText, { color: theme.textTertiary }]}
                numberOfLines={1}
              >
                {planSteps.length > 0
                  ? `✓ ${planSteps.length} step${planSteps.length === 1 ? '' : 's'} · ${planSteps[planSteps.length - 1]}`
                  : planProgress}
              </Text>
            </View>
          ) : browsingSteps.length > 0 ? (
            <View style={styles.browsingProgress}>
              <ActivityIndicator size="small" color={theme.textTertiary} />
              <Text
                style={[styles.typingText, { color: theme.textTertiary }]}
                numberOfLines={1}
              >
                {formatBrowsingStepLabel(browsingSteps[browsingSteps.length - 1])}
              </Text>
            </View>
          ) : (
            <>
              <ActivityIndicator size="small" color={theme.textTertiary} />
              <Text style={[styles.typingText, { color: theme.textTertiary }]}>Thinking…</Text>
            </>
          )}
        </View>
      )}

      {pendingAttachment && (
        <View style={[styles.attachmentPreview, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          {pendingAttachment.mimeType?.startsWith('image/') ? (
            <Image
              source={{ uri: pendingAttachment.uri }}
              style={styles.attachmentPreviewThumb}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="attach-outline" size={16} color={theme.textPrimary} style={styles.attachmentPreviewIcon} />
          )}
          <Text style={[styles.attachmentPreviewText, { color: theme.textPrimary }]} numberOfLines={1}>
            {pendingAttachment.name}
          </Text>
          <TouchableOpacity onPress={() => setPendingAttachment(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>
      )}

      {editingMessageId && (
        <View style={[styles.attachmentPreview, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Ionicons name="create-outline" size={16} color={theme.textPrimary} style={styles.attachmentPreviewIcon} />
          <Text style={[styles.attachmentPreviewText, { color: theme.textPrimary }]} numberOfLines={1}>
            Editing message
          </Text>
          <TouchableOpacity onPress={handleCancelEdit} hitSlop={8}>
            <Ionicons name="close" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Solid opaque composer (white / #1C1C1E) — no glass bleed-through. */}
      <View style={[styles.composerWrap, { backgroundColor: theme.barTint || theme.background }]}>
        <View style={[
          styles.composerCard,
          {
            backgroundColor: theme.composer,
            borderColor: theme.composerBorder,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 16,
            shadowOpacity: theme.mode === 'dark' ? 0.45 : 0.12,
            elevation: 6,
          },
        ]}>
          <TextInput
            style={[
              styles.textInput,
              {
                color: isRecording ? theme.textSecondary : theme.textPrimary,
                fontStyle: isRecording ? 'italic' : 'normal',
              },
            ]}
            value={isRecording ? liveText : inputText}
            onChangeText={(t) => {
              if (isRecording) return; // live transcript owns the field while recording
              setInputText(t);
            }}
            placeholder="Message"
            placeholderTextColor={theme.textTertiary}
            multiline
            maxLength={8000}
          />
          <View style={styles.composerControls}>
            {isRecording ? (
              <>
                <TouchableOpacity
                  style={[styles.micCircle, { backgroundColor: theme.fill }]}
                  onPress={() => { haptic.medium(); stopDictation(); }}
                  accessibilityLabel="Stop dictation"
                >
                  <View style={[styles.stopSquare, { backgroundColor: theme.textPrimary }]} />
                </TouchableOpacity>
                <DictationWaveform
                  levels={dictationState.levels}
                  color={theme.textTertiary}
                  height={28}
                />
                <TouchableOpacity
                  style={[styles.sendCircle, { backgroundColor: (liveText.trim() || pendingAttachment) ? (theme.sendAccent || theme.speak) : theme.sendDisabled }]}
                  onPress={() => { haptic.medium(); handleSend(); }}
                  accessibilityLabel="Send"
                >
                  <Ionicons
                    name="arrow-up"
                    size={18}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.plusButton, { backgroundColor: theme.fill }]}
                  onPress={() => { haptic.light(); setAttachmentVisible(true); }}
                  accessibilityLabel="Add attachment"
                >
                  <Ionicons name="add" size={22} color={theme.textSecondary} />
                </TouchableOpacity>

                <View style={[styles.modelPill, { backgroundColor: theme.fill }]}>
                  <Ionicons name="sparkles" size={13} color={theme.brand} />
                  <Text style={[styles.modelPillText, { color: theme.textPrimary }]}>
                    {(preferences.permission_mode || 'auto').replace(/^./, (c) => c.toUpperCase())}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.browserToggle,
                    { backgroundColor: theme.fill },
                    preferences.browser_access_enabled && { backgroundColor: theme.infoSoft },
                  ]}
                  onPress={() => { haptic.select(); setBrowserAccessEnabled(!preferences.browser_access_enabled); }}
                  onLongPress={() => onOpenBrowser?.()}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !!preferences.browser_access_enabled }}
                  accessibilityLabel="Toggle browser access on or off. Long-press to open the live browser view."
                >
                  <Ionicons
                    name={preferences.browser_access_enabled ? 'globe' : 'globe-outline'}
                    size={18}
                    color={preferences.browser_access_enabled ? theme.brand : theme.textSecondary}
                  />
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                {/* Mic stays left of send/stop. While Working… + empty input, mic is a plain glyph (Muse). */}
                {isSending && !hasText && !editingMessageId ? (
                  <TouchableOpacity
                    onPress={() => { haptic.light(); startDictation(inputText); }}
                    accessibilityLabel="Dictate"
                    hitSlop={8}
                    style={{ width: 28, height: 32, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="mic" size={20} color={theme.textPrimary} />
                  </TouchableOpacity>
                ) : (
                  <Animated.View style={{ transform: [{ scale: composerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
                    <TouchableOpacity
                      style={[styles.micCircle, { backgroundColor: theme.fill }]}
                      onPress={() => { haptic.light(); startDictation(inputText); }}
                      accessibilityLabel="Dictate"
                    >
                      <Ionicons name="mic" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </Animated.View>
                )}

                <Animated.View style={{ transform: [{ scale: composerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
                  {editingMessageId ? (
                    <TouchableOpacity
                      style={[styles.sendCircle, { backgroundColor: hasText ? (theme.sendAccent || theme.speak) : theme.sendDisabled }]}
                      onPress={() => { haptic.medium(); handleSaveEdit(); }}
                      disabled={!hasText}
                      accessibilityLabel="Save edit"
                    >
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : isSending && !hasText ? (
                    <TouchableOpacity
                      style={[styles.sendCircle, { backgroundColor: theme.stopSoft || '#F5D0C5' }]}
                      onPress={() => { haptic.warning(); stopCurrentRun(); }}
                      accessibilityLabel="Stop current task"
                    >
                      <View style={[styles.stopSquare, { backgroundColor: theme.stopGlyph || theme.textPrimary, borderRadius: 3 }]} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.sendCircle, { backgroundColor: hasText ? (theme.sendAccent || theme.speak) : theme.sendDisabled }]}
                      onPress={() => { haptic.medium(); handleSend(); }}
                      disabled={!hasText}
                      accessibilityLabel="Send"
                    >
                      <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </Animated.View>
              </>
            )}
          </View>
        </View>
      </View>

      <AttachmentSheet
        visible={attachmentVisible}
        onClose={() => setAttachmentVisible(false)}
        onCamera={handleCamera}
        onPhotos={handlePhotos}
        onFiles={handleFiles}
        webSearchEnabled={webSearchEnabled}
        onToggleWebSearch={setWebSearchEnabled}
        githubEnabled={githubToolsEnabled}
        onToggleGithub={setGithubToolsEnabled}
        githubConfigured={githubConfigured}
      />

      {/* Long-press context menu - user messages only now (Copy/Edit).
          Assistant replies use the always-visible inline MessageActions
          row rendered under each bubble instead (Copy/Share/Play/Like/
          Dislike/Regenerate) - see MessageActions.js. MessageBubble only
          wires onLongPress for user bubbles, so `activeMessage` here will
          never actually be an assistant message. */}
      <MessageActionMenu
        visible={!!activeMessage}
        message={activeMessage}
        anchor={menuAnchor}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        onClose={closeActionMenu}
        onEdit={handleEditRequest}
        onCopyToast={(text) => toastRef.current?.show(text)}
      />
      <Toast ref={toastRef} />

      <ImageViewerModal
        visible={!!viewerImageUri}
        imageUri={viewerImageUri}
        onClose={() => setViewerImageUri(null)}
        onSaved={() => toastRef.current?.show('Saved to Photos')}
        onSaveError={(message) => toastRef.current?.show(message || 'Could not save image')}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
    minHeight: 56,
  },
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  identityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingLeft: 8,
    paddingRight: 16,
    borderRadius: 22,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 2,
  },
  identityName: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  identityStatus: {
    fontSize: 12,
    marginTop: 4,
  },
  modeTabsRow: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
  },
  modeTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
    padding: 3,
  },
  modeTab: {
    minWidth: 76, // two equal segments (Chat | Plan) so the control stays balanced
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modeTabText: {
    fontSize: 15,
    letterSpacing: -0.24,
  },
  chromeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSwitcher: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 9,
    padding: 2,
    maxWidth: 260,
  },
  modeSegmentSelected: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modeSegment: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSegmentText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.08,
  },
  messageList: {
    paddingVertical: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 16,
  },
  emptyGlyph: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    transform: [{ rotate: '12deg' }],
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.36,
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 15,
  },
  emptyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    paddingHorizontal: 8,
  },
  emptyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  emptyChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bubbleRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
    marginRight: 16,
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
    marginLeft: 16,
    marginRight: 16,
  },
  bubbleColUser: {
    maxWidth: '78%',
    alignItems: 'flex-end',
  },
  bubbleColAssistant: {
    width: '92%',
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '100%',
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  bubblePlainAssistant: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 2,
    borderRadius: 0,
  },
  generatedImage: {
    width: 260,
    height: 260,
    borderRadius: 16,
  },
  bubbleImagePadding: {
    padding: 4,
  },
  bubbleTextAfterImage: {
    marginTop: 8,
    marginHorizontal: 6,
  },
  bubbleFooter: {
    flexDirection: 'row',
  },
  modelTag: { fontSize: 11, fontWeight: '500', letterSpacing: 0.2, opacity: 0.55, marginTop: 4 },
  editedTag: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
    opacity: 0.6,
  },
  viewPlanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  viewPlanChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reasoningChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reasoningChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reasoningTraceBox: {
    marginTop: 6,
    alignSelf: 'stretch',
    padding: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reasoningTraceText: {
    fontSize: 12,
    lineHeight: 17,
  },
  confirmCard: {
    marginTop: 10,
    alignSelf: 'stretch',
    padding: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  confirmCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confirmCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmCardReason: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  confirmCardCommandBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  confirmCardCommandText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  confirmCardBackend: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  confirmCardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  confirmCardBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCardApproveBtn: {
    borderWidth: 0,
  },
  confirmCardBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  switchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 8,
  },
  switchChipIcon: {
    marginRight: 6,
  },
  switchChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  errorBannerText: {
    fontSize: 13,
    textAlign: 'center',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  typingText: {
    marginLeft: 8,
    fontSize: 13,
  },
  browsingProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  attachmentPreviewIcon: {
    marginRight: 6,
  },
  attachmentPreviewThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: 8,
  },
  attachmentPreviewText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  composerWrap: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  composerCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
    overflow: 'visible',
  },
  micCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  composerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  plusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  modelPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  browserToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 17,
    letterSpacing: -0.41,
    maxHeight: 100,
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 28,
  },
  actionSlot: {
    minWidth: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  sendButtonWrap: {
    position: 'absolute',
    right: 0,
  },
  sendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  sendCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
