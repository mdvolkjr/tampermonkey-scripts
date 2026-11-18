// Any tab group whose title matches this pattern gets closed.
const CLAUDE_GROUP_PATTERN = /claude/i;

async function closeClaudeGroups() {
  // Never close the group the user is currently working in — a Claude
  // session that's running right now lives in the active tab's group.
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const activeGroupId = activeTab ? activeTab.groupId : chrome.tabGroups.TAB_GROUP_ID_NONE;

  const groups = await chrome.tabGroups.query({});
  const targets = groups.filter(
    (g) => CLAUDE_GROUP_PATTERN.test(g.title || "") && g.id !== activeGroupId
  );

  let closed = 0;
  for (const group of targets) {
    const tabs = await chrome.tabs.query({ groupId: group.id });
    if (tabs.length) {
      await chrome.tabs.remove(tabs.map((t) => t.id));
      closed++;
    }
  }

  // Brief badge so the click visibly did something.
  await chrome.action.setBadgeBackgroundColor({ color: "#C15F3C" });
  await chrome.action.setBadgeText({ text: String(closed) });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2500);
}

chrome.action.onClicked.addListener(closeClaudeGroups);
chrome.commands.onCommand.addListener((command) => {
  if (command === "close-claude-groups") closeClaudeGroups();
});
