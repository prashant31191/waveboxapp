const GoogleService = require('./GoogleService')
const addressparser = require('addressparser')

const ACCESS_MODES = Object.freeze({
  GINBOX: 'GINBOX',
  GMAIL: 'GMAIL'
})
const UNREAD_MODES = Object.freeze({
  INBOX_ALL: 'INBOX_ALL',
  INBOX_UNREAD: 'INBOX_UNREAD',
  INBOX_UNREAD_IMPORTANT: 'INBOX_UNREAD_IMPORTANT',
  INBOX_UNREAD_PERSONAL: 'INBOX_UNREAD_PERSONAL',
  INBOX_UNREAD_UNBUNDLED: 'INBOX_UNREAD_UNBUNDLED'
})

class GoogleDefaultService extends GoogleService {
  /* **************************************************************************/
  // Class
  /* **************************************************************************/

  static get type () { return GoogleService.SERVICE_TYPES.DEFAULT }
  static get ACCESS_MODES () { return ACCESS_MODES }
  static get UNREAD_MODES () { return UNREAD_MODES }

  /* **************************************************************************/
  // Class: Support
  /* **************************************************************************/

  static get supportsUnreadCount () { return true }
  static get supportsTrayMessages () { return true }
  static get supportsSyncedDiffNotifications () { return true }
  static get supportsNativeNotifications () { return true }
  static get supportsSyncWhenSleeping () { return true }

  /* **************************************************************************/
  // Properties
  /* **************************************************************************/

  get accessMode () { return this._value_('accessMode', ACCESS_MODES.GINBOX) }
  get url () {
    switch (this.accessMode) {
      case ACCESS_MODES.GMAIL: return 'https://mail.google.com?ibxr=0'
      case ACCESS_MODES.GINBOX: return 'https://inbox.google.com'
    }
  }
  get unreadMode () {
    switch (this.accessMode) {
      case ACCESS_MODES.GMAIL: return this._value_('unreadMode', UNREAD_MODES.INBOX_UNREAD)
      case ACCESS_MODES.GINBOX: return this._value_('unreadMode', UNREAD_MODES.INBOX_UNREAD_UNBUNDLED)
    }
  }
  get supportedUnreadModes () {
    switch (this.accessMode) {
      case ACCESS_MODES.GMAIL:
        return new Set([
          UNREAD_MODES.INBOX_ALL,
          UNREAD_MODES.INBOX_UNREAD,
          UNREAD_MODES.INBOX_UNREAD_IMPORTANT,
          UNREAD_MODES.INBOX_UNREAD_PERSONAL
        ])
      case ACCESS_MODES.GINBOX:
        return new Set([
          UNREAD_MODES.INBOX_ALL,
          UNREAD_MODES.INBOX_UNREAD,
          UNREAD_MODES.INBOX_UNREAD_UNBUNDLED
        ])
    }
  }

  get sleepable () { return this._value_('sleepable', false) }
  get reloadBehaviour () {
    switch (this.accessMode) {
      case ACCESS_MODES.GMAIL: return this.constructor.RELOAD_BEHAVIOURS.RESET_URL
      case ACCESS_MODES.GINBOX: return this.constructor.RELOAD_BEHAVIOURS.RELOAD
    }
  }

  /* **************************************************************************/
  // Properties: Custom search
  /* **************************************************************************/

  get customUnreadQuery () { return this._value_('customUnreadQuery', '').trim() }
  get hasCustomUnreadQuery () { return !!this.customUnreadQuery }
  get customUnreadLabelWatchString () { return this._value_('customUnreadLabelWatchString', '').trim() }
  get customUnreadLabelWatchArray () {
    return this.customUnreadLabelWatchString
      .split(',')
      .map((l) => l.trim().toUpperCase())
      .filter((l) => !!l)
  }
  get hasCustomUnreadLabelWatch () { return !!this.customUnreadLabelWatchString }

  /* **************************************************************************/
  // Properties: Humanized
  /* **************************************************************************/

  get humanizedType () {
    switch (this.accessMode) {
      case ACCESS_MODES.GMAIL: return 'Gmail'
      case ACCESS_MODES.GINBOX: return 'Google Inbox'
    }
  }
  get humanizedTypeShort () {
    switch (this.accessMode) {
      case ACCESS_MODES.GMAIL: return 'Gmail'
      case ACCESS_MODES.GINBOX: return 'Inbox'
    }
  }
  get humanizedLogos () {
    switch (this.accessMode) {
      case ACCESS_MODES.GMAIL: return [
        'images/google/logo_gmail_32px.png',
        'images/google/logo_gmail_48px.png',
        'images/google/logo_gmail_64px.png',
        'images/google/logo_gmail_128px.png'
      ]
      case ACCESS_MODES.GINBOX: return [
        'images/google/logo_ginbox_32px.png',
        'images/google/logo_ginbox_48px.png',
        'images/google/logo_ginbox_64px.png',
        'images/google/logo_ginbox_128px.png'
      ]
    }
  }
  get humanizedLogo () { return this.humanizedLogos[this.humanizedLogos.length - 1] }

  /* **************************************************************************/
  // Properties: Protocols & actions
  /* **************************************************************************/

  get supportedProtocols () { return new Set([GoogleService.PROTOCOL_TYPES.MAILTO]) }
  get supportsCompose () { return true }

  /* **************************************************************************/
  // Properties : Messages & unread info
  /* **************************************************************************/

  get historyId () { return this._value_('historyId') }
  get hasHistoryId () { return !!this.historyId }
  get unreadCount () { return this._value_('unreadCount', 0) }
  get unreadThreads () { return this._value_('unreadThreads', []) }
  get unreadThreadsIndexed () {
    return this.unreadThreads.reduce((acc, thread) => {
      acc[thread.id] = thread
      return acc
    }, {})
  }

  /* **************************************************************************/
  // Properties : Provider Details & counts etc
  /* **************************************************************************/

  /**
  * Generates the open data for the message
  * @param thread: the thread to open
  * @param message: the message to open
  */
  _generateMessageOpenData (thread, message) {
    const data = {
      mailboxId: this.parentId,
      serviceType: this.type,
      threadId: thread.id,
      messageId: message.id
    }

    if (this.accessMode === ACCESS_MODES.GINBOX) {
      let fromAddress
      try { fromAddress = addressparser(message.from)[0].address } catch (ex) { /* no-op */ }
      let toAddress
      try { toAddress = addressparser(message.to)[0].address } catch (ex) { /* no-op */ }
      const messageDate = new Date(parseInt(message.internalDate))

      data.search = [
        fromAddress ? `from:"${fromAddress}"` : undefined,
        toAddress ? `to:${toAddress}` : undefined,
        message.subject ? `subject:"${message.subject}"` : undefined,
        `after:${messageDate.getFullYear()}/${messageDate.getMonth() + 1}/${messageDate.getDate()}`,
        `before:${messageDate.getFullYear()}/${messageDate.getMonth() + 1}/${messageDate.getDate() + 1}` // doesn't cope with end of months, but goog seems okay with it
      ].filter((q) => !!q).join(' ')
    }

    return data
  }

  get trayMessages () {
    return this.unreadThreads.map((thread) => {
      const message = thread.latestMessage
      let fromName = ''
      if (message.from) {
        try {
          fromName = addressparser(message.from)[0].name || message.from
        } catch (ex) {
          fromName = message.from
        }
      }

      return {
        id: `${thread.id}:${thread.historyId}`,
        text: `${fromName} : ${message.subject || 'No Subject'}`,
        date: parseInt(message.internalDate),
        data: this._generateMessageOpenData(thread, message)
      }
    })
  }
  get notifications () {
    return this.unreadThreads.map((thread) => {
      const message = thread.latestMessage
      return {
        id: `${thread.id}:${message.internalDate}`,
        title: message.subject || 'No Subject',
        titleFormat: 'text',
        body: [
          { content: message.from, format: 'text' },
          { content: message.snippet, format: 'html' }
        ],
        timestamp: parseInt(message.internalDate),
        data: this._generateMessageOpenData(thread, message)
      }
    })
  }

  /* **************************************************************************/
  // Behaviour
  /* **************************************************************************/

  /**
  * Gets the window open mode for a given url
  * @param url: the url to open with
  * @param parsedUrl: the url object parsed by nodejs url
  * @param disposition: the open mode disposition
  * @param provisionalTargetUrl: the provisional target url that the user may be hovering over or have highlighted
  * @param parsedProvisionalTargetUrl: the provisional target parsed by nodejs url
  * @return the window open mode
  */
  getWindowOpenModeForUrl (url, parsedUrl, disposition, provisionalTargetUrl, parsedProvisionalTargetUrl) {
    const superMode = super.getWindowOpenModeForUrl(url, parsedUrl, disposition, provisionalTargetUrl, parsedProvisionalTargetUrl)
    if (superMode !== this.constructor.WINDOW_OPEN_MODES.DEFAULT) { return superMode }
    if (parsedUrl.hostname === 'mail.google.com') {
      if (parsedUrl.query.ui === '2') {
        switch (parsedUrl.query.view) {
          case 'pt': return this.constructor.WINDOW_OPEN_MODES.POPUP_CONTENT // Print message
          case 'btop': return this.constructor.WINDOW_OPEN_MODES.POPUP_CONTENT // Open google drive doc. This doesn't work with default_important. Context is lost
          case 'lg': return this.constructor.WINDOW_OPEN_MODES.POPUP_CONTENT // Open entire message (after being clipped)
          case 'att': return this.constructor.WINDOW_OPEN_MODES.POPUP_CONTENT // Open attachment in external window (also works on inbox)
        }
      }

      if (parsedUrl.query.view === 'om') { // View original. (Also from inbox.google.com)
        return this.constructor.WINDOW_OPEN_MODES.CONTENT
      }
    }

    return this.constructor.WINDOW_OPEN_MODES.DEFAULT
  }
}

module.exports = GoogleDefaultService
