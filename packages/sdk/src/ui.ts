// [sdk] src/ui.ts

/**
 * UI primitives that a plugin can render into the Jimcast command bar.
 *
 * Plugins do not have arbitrary UI access. They can only produce:
 * - A list of {@link CommandItem}s (what the user sees and navigates)
 * - {@link Action}s attached to each item (what happens when the user acts)
 * - A {@link Preview} for the selected item (optional right-hand panel)
 *
 * Everything else — layout, theming, window chrome — is owned by Jimcast core.
 */

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

/**
 * An action attached to a {@link CommandItem}.
 *
 * Actions appear in the action panel when the user presses ⌘K on an item.
 * The first action in the list is the primary action, triggered by ↵.
 */
export interface Action {
  /**
   * Stable identifier for this action.
   * Used for keyboard shortcut deduplication and accessibility.
   */
  readonly id: string;

  /**
   * Label shown in the action panel. Use a verb phrase.
   * Examples: "Open in Editor", "Copy to Clipboard", "Delete Branch"
   */
  readonly title: string;

  /**
   * Optional keyboard shortcut. Must be a valid Jimcast shortcut string.
   * Format: modifier+key — e.g. `"cmd+shift+c"`, `"ctrl+o"`.
   *
   * Shortcuts are sandboxed to the command bar — they only fire when the
   * plugin's items are active.
   */
  readonly shortcut?: string;

  /**
   * Called when the user triggers this action.
   * Throwing from here surfaces an error toast to the user.
   */
  onAction(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

/**
 * Optional preview panel shown alongside a selected {@link CommandItem}.
 *
 * The preview panel is a read-only display — it cannot receive focus or
 * contain interactive elements.
 */
export type Preview =
  | { readonly type: "markdown"; readonly content: string }
  | { readonly type: "text"; readonly content: string };

// ---------------------------------------------------------------------------
// CommandItem
// ---------------------------------------------------------------------------

/**
 * A single row rendered in the Jimcast command bar.
 *
 * When a command's `execute()` returns a list of these, the user can navigate
 * the list and trigger actions on each item.
 *
 * @example
 * ```typescript
 * const item: CommandItem = {
 *   id: "branch-main",
 *   title: "main",
 *   subtitle: "Last commit: fix auth flow",
 *   accessory: "2 hours ago",
 *   actions: [
 *     {
 *       id: "checkout",
 *       title: "Checkout Branch",
 *       shortcut: "cmd+return",
 *       async onAction() {
 *         await context.exec("git checkout main");
 *       },
 *     },
 *   ],
 * };
 * ```
 */
export interface CommandItem {
  /**
   * Stable identifier for this item within the current result list.
   * Used to preserve keyboard position on list refresh.
   */
  readonly id: string;

  /**
   * Primary label — the most prominent text in the row.
   */
  readonly title: string;

  /**
   * Secondary label shown below or beside the title.
   * Use for context that helps the user distinguish between similar items.
   */
  readonly subtitle?: string;

  /**
   * Right-aligned label at the trailing edge of the row.
   * Good for status labels, timestamps, or counts — e.g. `"modified 2m ago"`.
   */
  readonly accessory?: string;

  /**
   * Extra search terms for fuzzy matching.
   * Include aliases, abbreviations, or alternative phrasings that a user
   * might type but wouldn't appear in `title` or `subtitle`.
   */
  readonly keywords?: readonly string[];

  /**
   * Actions available on this item.
   * Must contain at least one action. The first is the primary (↵).
   */
  readonly actions: readonly [Action, ...Action[]];

  /**
   * Optional preview panel content for this item.
   * Shown in the right-hand panel when the item is selected.
   */
  readonly preview?: Preview;
}
