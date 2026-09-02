import { App, Modal, Platform, setIcon, TFile } from "obsidian";
import { NoteRefs } from "./backlinks";
import { SANDBOX_SCRIPTS } from "./constants";
import { t } from "./i18n";
import { showNoteMenu } from "./note-menu";

/** Not in the official typings, but available on desktop: opens a file with the default app */
type AppWithDefaultApp = App & { openWithDefaultApp?: (path: string) => void };

export interface PreviewModalOptions {
  file: TFile;
  title: string;
  resourceUrl: string;
  refs: NoteRefs;
  onOpenNote: (note: TFile) => void;
}

/** Enlarged view opened by clicking a card. Scripts are always enabled so the HTML renders as intended */
export class HtmlPreviewModal extends Modal {
  constructor(
    app: App,
    private options: PreviewModalOptions,
  ) {
    super(app);
  }

  onOpen(): void {
    const { file, title, resourceUrl, refs } = this.options;
    this.modalEl.addClass("html-gallery-modal");
    this.titleEl.setText(title);

    const content = this.contentEl;
    content.empty();
    content.addClass("html-gallery-modal-content");

    const toolbar = content.createDiv({ cls: "html-gallery-modal-toolbar" });
    toolbar.createSpan({ cls: "html-gallery-modal-path", text: file.path });

    const actions = toolbar.createDiv({ cls: "html-gallery-modal-actions" });
    this.renderNotesButton(actions, refs);

    if (Platform.isDesktopApp) {
      const openExternal = actions.createEl("button", { cls: "html-gallery-modal-button" });
      setIcon(openExternal.createSpan({ cls: "html-gallery-button-icon" }), "external-link");
      openExternal.createSpan({ text: t("modal.openDefaultApp") });
      openExternal.addEventListener("click", () => {
        (this.app as AppWithDefaultApp).openWithDefaultApp?.(file.path);
      });
    }

    const frameWrap = content.createDiv({ cls: "html-gallery-modal-frame" });
    const iframe = frameWrap.createEl("iframe", { cls: "html-gallery-modal-iframe" });
    iframe.setAttribute("sandbox", SANDBOX_SCRIPTS);
    iframe.setAttribute("title", title);
    iframe.src = resourceUrl;
  }

  private renderNotesButton(parent: HTMLElement, refs: NoteRefs): void {
    if (refs.notes.length === 0) return;
    const isResolved = refs.kind === "resolved";
    const btn = parent.createEl("button", {
      cls: `html-gallery-modal-button html-gallery-refs-button is-${refs.kind}`,
      attr: { title: isResolved ? t("refs.backlinkHint") : t("refs.siblingHint") },
    });
    setIcon(btn.createSpan({ cls: "html-gallery-button-icon" }), isResolved ? "link" : "folder");
    btn.createSpan({
      text: isResolved
        ? t("modal.backlinks", { n: refs.notes.length })
        : t("modal.siblings", { n: refs.notes.length }),
    });
    btn.addEventListener("click", (evt) => {
      showNoteMenu(
        this.app,
        {
          file: this.options.file,
          refs,
          onOpen: (note) => {
            this.close();
            this.options.onOpenNote(note);
          },
        },
        evt,
      );
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
