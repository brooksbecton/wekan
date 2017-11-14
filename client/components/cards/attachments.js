import { PDFJS } from 'meteor/pascoual:pdfjs';

Template.attachmentsGalery.events({
  'click .js-add-attachment': Popup.open('cardAttachments'),
  'click .js-confirm-delete': Popup.afterConfirm('attachmentDelete',
    function () {
      Attachments.remove(this._id);
      Popup.close();
    }
  ),
  // If we let this event bubble, FlowRouter will handle it and empty the page
  // content, see #101.
  'click .js-download'(event) {
    event.stopPropagation();
  },
  'click .js-add-cover'() {
    Cards.findOne(this.cardId).setCover(this._id);
  },
  'click .js-remove-cover'() {
    Cards.findOne(this.cardId).unsetCover();
  },
  'click .attachment-item'(event) {
    event.preventDefault();
    const { currentTarget: { innerText: attachmentExtension } } = event;
    if (attachmentExtension.toLowerCase().includes('pdf')) {
      const pdfUrl = $(event.target).closest('a')[0].href;
      PDFJS.workerSrc = '/packages/pascoual_pdfjs/build/pdf.worker.js';

      // Create PDF
      PDFJS.getDocument(pdfUrl).then(function getPdf(pdf) {
        // Fetch the first page
        pdf.getPage(1).then(function getPageHelloWorld(page) {
          const scale = 1;
          const viewport = page.getViewport(scale);

          // Prepare canvas using PDF page dimensions
          const canvas = $('.pdf-preview')[0];
          const canvasContext = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // Render PDF page into canvas context
          page.render({ canvasContext, viewport });
        });
      });

    }
  },
  'click .js-preview-image'(evt) {
    Popup.open('previewAttachedImage').call(this, evt);
    // when multiple thumbnails, if click one then another very fast,
    // we might get a wrong width from previous img.
    // when popup reused, onRendered() won't be called, so we cannot get there.
    // here make sure to get correct size when this img fully loaded.
    const img = $('img.preview-large-image')[0];
    if (!img) return;
    const rePosPopup = () => {
      const w = img.width;
      const h = img.height;
      // if the image is too large, we resize & center the popup.
      if (w > 300) {
        $('div.pop-over').css({
          width: (w + 20),
          position: 'absolute',
          left: (window.innerWidth - w) / 2,
          top: (window.innerHeight - h) / 2,
        });
      }
    };
    const url = $(evt.currentTarget).attr('src');
    if (img.src === url && img.complete)
      rePosPopup();
    else
      img.onload = rePosPopup;
  },
});

Template.previewAttachedImagePopup.events({
  'click .js-large-image-clicked'() {
    Popup.close();
  },
});

Template.cardAttachmentsPopup.events({
  'change .js-attach-file'(evt) {
    const card = this;
    FS.Utility.eachFile(evt, (f) => {
      const file = new FS.File(f);
      file.boardId = card.boardId;
      file.cardId = card._id;
      file.userId = Meteor.userId();
      Attachments.insert(file);
      Popup.close();
    });
  },
  'click .js-computer-upload'(evt, tpl) {
    tpl.find('.js-attach-file').click();
    evt.preventDefault();
  },
  'click .js-upload-clipboard-image': Popup.open('previewClipboardImage'),
});

let pastedResults = null;

Template.previewClipboardImagePopup.onRendered(() => {
  // we can paste image from clipboard
  $(document.body).pasteImageReader((results) => {
    if (results.dataURL.startsWith('data:image/')) {
      $('img.preview-clipboard-image').attr('src', results.dataURL);
      pastedResults = results;
    }
  });

  // we can also drag & drop image file to it
  $(document.body).dropImageReader((results) => {
    if (results.dataURL.startsWith('data:image/')) {
      $('img.preview-clipboard-image').attr('src', results.dataURL);
      pastedResults = results;
    }
  });
});

Template.previewClipboardImagePopup.events({
  'click .js-upload-pasted-image'() {
    const results = pastedResults;
    if (results && results.file) {
      const card = this;
      const file = new FS.File(results.file);
      if (!results.name) {
        // if no filename, it's from clipboard. then we give it a name, with ext name from MIME type
        if (typeof results.file.type === 'string') {
          file.name(results.file.type.replace('image/', 'clipboard.'));
        }
      }
      file.updatedAt(new Date());
      file.boardId = card.boardId;
      file.cardId = card._id;
      file.userId = Meteor.userId();
      Attachments.insert(file);
      pastedResults = null;
      $(document.body).pasteImageReader(() => { });
      Popup.close();
    }
  },
});
