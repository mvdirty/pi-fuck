import type { ExtensionAPI, SessionEntry } from "@mariozechner/pi-coding-agent";

function isUserMessageEntry(
	entry: SessionEntry,
): entry is SessionEntry & { type: "message"; message: { role: "user" } } {
	return entry.type === "message" && entry.message.role === "user";
}

export default function piFuck(pi: ExtensionAPI) {
	let isCompacting = false;

	const clearCompactionState = () => {
		isCompacting = false;
	};

	pi.on("session_start", clearCompactionState);
	pi.on("session_shutdown", clearCompactionState);
	pi.on("session_before_compact", ({ signal }) => {
		isCompacting = true;
		signal.addEventListener("abort", clearCompactionState, { once: true });
	});
	pi.on("session_compact", clearCompactionState);

	pi.registerCommand("fuck", {
		description: "Abort the current run and recover the last user prompt into the editor",
		handler: async (args, ctx) => {
			if (args.trim()) {
				ctx.ui.notify("Usage: /fuck", "warning");
				return;
			}

			if (isCompacting) {
				ctx.ui.notify(
					"Can't /fuck during compaction. Press Esc to cancel compaction, then run /fuck again.",
					"warning",
				);
				return;
			}

			if (ctx.hasPendingMessages()) {
				ctx.ui.notify(
					"Can't /fuck while queued messages exist. Restore or send them first.",
					"warning",
				);
				return;
			}

			if (!ctx.isIdle()) {
				ctx.abort();
				await ctx.waitForIdle();
			}

			const lastUserMessage = ctx.sessionManager.getBranch().findLast(isUserMessageEntry);
			if (!lastUserMessage) {
				ctx.ui.notify("Nothing to recover on this branch. Use /tree for manual navigation.", "info");
				return;
			}

			const result = await ctx.navigateTree(lastUserMessage.id);
			if (result.cancelled) {
				ctx.ui.notify("Recovery cancelled.", "info");
				return;
			}

			ctx.ui.notify("fuck: navigated back to last prompt", "info");
		},
	});
}
