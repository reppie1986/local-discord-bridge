/**
 * Scoped listener logic test harness.
 * Tests pure functions from the compiled build:
 *   eventInScope   — guild/channel/parentId scope filtering
 *   classifyAttention — attention labeling (replaces old routingMode filter)
 *
 * Does NOT need Discord gateway — just scope configs and fake events.
 */

import { eventInScope, classifyAttention } from './build/tools/scoped.js';
import { resolveAttentionMode } from './build/config.js';

let passed = 0;
let failed = 0;

function assert(label, ok) {
  if (ok) { passed++; console.log(`  PASS: ${label}`); }
  else { failed++; console.log(`  FAIL: ${label}`); }
}

// ── Scope definitions ──────────────────────────────────────────

const havenScope = {
  guildIds: ['100'],
  channelIds: ['200', '201'],
  defaultChannelId: '200',
};

const thirdeyeScope = {
  guildIds: ['300'],
  channelIds: ['400'],
  defaultChannelId: '400',
};

const testAll = {
  guildIds: ['100'],
  channelIds: ['200'],
  defaultChannelId: '200',
  attentionMode: 'all',
};

const testMentions = {
  guildIds: ['100'],
  channelIds: ['200'],
  defaultChannelId: '200',
  attentionMode: 'mentions_only',
  includeRepliesToSelf: true,
};

const testNameMatch = {
  guildIds: ['100'],
  channelIds: ['200'],
  defaultChannelId: '200',
  attentionMode: 'name_match',
  names: ['Gremy', 'gremy'],
  includeRepliesToSelf: false,
};

const testKeywords = {
  guildIds: ['100'],
  channelIds: ['200'],
  defaultChannelId: '200',
  attentionMode: 'keywords',
  keywords: ['urgent', 'help'],
  includeRepliesToSelf: false,
};

const testMentionsOnlyNoReplies = {
  guildIds: ['100'],
  channelIds: ['200'],
  defaultChannelId: '200',
  attentionMode: 'mentions_only',
  includeRepliesToSelf: false,
};

// routingMode alias (backward compat)
const testAlias = {
  guildIds: ['100'],
  channelIds: ['200'],
  defaultChannelId: '200',
  routingMode: 'mentions_only',
};

// ── routingMode alias ──────────────────────────────────────────
console.log('\n=== routingMode → attentionMode alias ===');
assert('resolveAttentionMode reads attentionMode first',
  resolveAttentionMode(testMentions) === 'mentions_only');
assert('resolveAttentionMode falls back to routingMode',
  resolveAttentionMode(testAlias) === 'mentions_only');

// ── Test 1: Scope guild/channel filtering ──────────────────────
console.log('\n=== Scope guild/channel filtering ===');

const havenEvent = { guildId: '100', channelId: '200' };
const wrongGuild = { guildId: '999', channelId: '200' };
const wrongChannel = { guildId: '100', channelId: '999' };

assert('haven scope accepts matching guild+channel',
  eventInScope(havenEvent, havenScope));
assert('haven scope rejects wrong guild',
  !eventInScope(wrongGuild, havenScope));
assert('haven scope rejects wrong channel',
  !eventInScope(wrongChannel, havenScope));

assert('thirdeye scope accepts its own event',
  eventInScope({ guildId: '300', channelId: '400' }, thirdeyeScope));
assert('thirdeye scope rejects haven event',
  !eventInScope(havenEvent, thirdeyeScope));

const noFilterScope = { guildIds: [], channelIds: [], defaultChannelId: '' };
assert('empty guildIds + channelIds allows all',
  eventInScope({ guildId: 'anything', channelId: 'anything' }, noFilterScope));

const guildOnly = { guildIds: ['100'], channelIds: [], defaultChannelId: '' };
assert('guild-only filter allows any channel in guild',
  eventInScope({ guildId: '100', channelId: 'any' }, guildOnly));
assert('guild-only filter rejects wrong guild',
  !eventInScope({ guildId: '999', channelId: 'any' }, guildOnly));

const channelOnly = { guildIds: [], channelIds: ['200'], defaultChannelId: '' };
assert('channel-only filter allows any guild in channel',
  eventInScope({ guildId: 'any', channelId: '200' }, channelOnly));
assert('channel-only filter rejects wrong channel',
  !eventInScope({ guildId: 'any', channelId: '999' }, channelOnly));

// ── Test 2: Thread handling (parentId) ─────────────────────────
console.log('\n=== Thread handling (parentId) ===');

const threadInScope = { guildId: '100', channelId: 'thread-999', parentId: '200' };
const threadWrongParent = { guildId: '100', channelId: 'thread-999', parentId: '888' };

assert('thread passes when parentId is in scope channelIds',
  eventInScope(threadInScope, havenScope));
assert('thread blocked when parentId not in scope channelIds',
  !eventInScope(threadWrongParent, havenScope));

assert('non-thread event (no parentId) checks channelId directly',
  eventInScope({ guildId: '100', channelId: '200' }, havenScope));

// ── Test 3: Ack scope rejection ────────────────────────────────
console.log('\n=== Ack scope rejection ===');

assert('ack: event in scope passes',
  eventInScope(havenEvent, havenScope));
assert('ack: event not in scope fails',
  !eventInScope(wrongChannel, havenScope));

// ── Test 4: attentionMode: all ─────────────────────────────────
console.log('\n=== attentionMode: all ===');

const anyEvent = { mentionsBot: false, content: 'random noise', replyTo: undefined };
const r1 = classifyAttention(anyEvent, testAll, 'bot-1');
assert('attention=all labels every event',
  r1.attention === true && r1.reason === 'all');

const mentionEvent = { mentionsBot: true, content: 'hello @bot', replyTo: undefined };
const r2 = classifyAttention(mentionEvent, testAll, 'bot-1');
assert('attention=all labels @mention as mention',
  r2.attention === true && r2.reason === 'mention');

// ── Test 5: attentionMode: mentions_only ───────────────────────
console.log('\n=== attentionMode: mentions_only ===');

const noMention = { mentionsBot: false, content: 'hello', replyTo: undefined };
const replyToSelf = { mentionsBot: false, content: 'lol', replyTo: { authorId: 'bot-1', messageId: 'x', content: '' } };
const replyToOther = { mentionsBot: false, content: 'lol', replyTo: { authorId: 'user-5', messageId: 'x', content: '' } };

assert('mentions_only: @mention gets attention',
  classifyAttention(mentionEvent, testMentions, 'bot-1').attention === true);
assert('mentions_only: non-mention no attention',
  classifyAttention(noMention, testMentions, 'bot-1').attention === false);
assert('mentions_only: reply-to-self gets attention',
  classifyAttention(replyToSelf, testMentions, 'bot-1').attention === true);
assert('mentions_only: reply-to-other no attention',
  classifyAttention(replyToOther, testMentions, 'bot-1').attention === false);
assert('mentions_only: reply-to-self blocked when includeRepliesToSelf=false',
  classifyAttention(replyToSelf, testMentionsOnlyNoReplies, 'bot-1').attention === false);

// ── Test 6: attentionMode: name_match ──────────────────────────
console.log('\n=== attentionMode: name_match ===');

assert('name_match: exact match gets attention',
  classifyAttention({ mentionsBot: false, content: 'Hey Gremy whats up', replyTo: undefined }, testNameMatch, 'bot-1').attention === true);
assert('name_match: case-insensitive',
  classifyAttention({ mentionsBot: false, content: 'hey gremy', replyTo: undefined }, testNameMatch, 'bot-1').attention === true);
assert('name_match: no match no attention',
  classifyAttention({ mentionsBot: false, content: 'hey there', replyTo: undefined }, testNameMatch, 'bot-1').attention === false);
assert('name_match: @mention still gets attention even without name',
  classifyAttention({ mentionsBot: true, content: 'hello', replyTo: undefined }, testNameMatch, 'bot-1').attention === true);

// ── Test 7: attentionMode: keywords ────────────────────────────
console.log('\n=== attentionMode: keywords ===');

assert('keywords: match gets attention',
  classifyAttention({ mentionsBot: false, content: 'this is urgent', replyTo: undefined }, testKeywords, 'bot-1').attention === true);
assert('keywords: case-insensitive',
  classifyAttention({ mentionsBot: false, content: 'HELP me', replyTo: undefined }, testKeywords, 'bot-1').attention === true);
assert('keywords: no match no attention',
  classifyAttention({ mentionsBot: false, content: 'everything is fine', replyTo: undefined }, testKeywords, 'bot-1').attention === false);

// ── Test 8: Attention reason strings ───────────────────────────
console.log('\n=== Attention reasons ===');

assert('reason=mention for @mention',
  classifyAttention(mentionEvent, testAll, 'bot-1').reason === 'mention');
assert('reason=reply_to_self for reply to bot',
  classifyAttention(replyToSelf, testMentions, 'bot-1').reason === 'reply_to_self');
assert('reason=all for all mode',
  classifyAttention(anyEvent, testAll, 'bot-1').reason === 'all');
assert('reason=null for non-attention events',
  classifyAttention(noMention, testMentionsOnlyNoReplies, 'bot-1').reason === null);

// ── Test 9: Async replyTo race ─────────────────────────────────
console.log('\n=== Async replyTo race condition ===');
console.log('  Scenario: event enters queue, replyTo.authorId is empty,');
console.log('  pending filter runs before async fetch completes.');
console.log('  Mitigation: cache-first resolve in listener.ts.');
console.log('  Fallback: unresolved reply treated as not-to-self.');
assert('race: unresolved replyTo fails includeRepliesToSelf check',
  !classifyAttention(
    { mentionsBot: false, content: 'hi', replyTo: { authorId: '', messageId: 'x', content: '' } },
    { guildIds: ['100'], channelIds: ['200'], defaultChannelId: '200', attentionMode: 'mentions_only', includeRepliesToSelf: true },
    'bot-1').attention);

// ── Summary ────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
