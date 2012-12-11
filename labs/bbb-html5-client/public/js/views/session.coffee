define [
  'jquery',
  'underscore',
  'backbone',
  'globals',
  'text!templates/session.html',
  'cs!views/session_navbar',
  'cs!views/session_chat',
  'cs!views/session_users',
  'cs!views/session_whiteboard'
], ($, _, Backbone, globals, sessionTemplate, SessionNavbarView,
    SessionChatView, SessionUsersView, SessionWhiteboardView) ->

  SessionView = Backbone.View.extend
    id: 'session-view'
    # className: 'users-enabled' # to start with #users opened
    events:
      "click #colourView": "toogleColorPicker"

    initialize: ->
      @navbarView = new SessionNavbarView()
      @navbarView.$parentEl = @$el
      @chatView = new SessionChatView()
      @usersView = new SessionUsersView()
      @whiteboardView = new SessionWhiteboardView()

    # Override the close() method so we can close the sub-views.
    close: ->
      @navbarView.close()
      @chatView.close()
      @usersView.close()
      @whiteboardView.close()
      this.remove()
      this.unbind()

    render: ->
      data = { auth: globals.currentAuth }
      compiledTemplate = _.template(sessionTemplate, data)
      @$el.append compiledTemplate

      @assign(@navbarView, "#navbar")
      @assign(@chatView, "#chat")
      @assign(@usersView, "#users")
      @assign(@whiteboardView, "#presentation")

      # Connect to the server
      globals.connection.connect()

      @

    # Toogle the current color picker
    toogleColorPicker: ->
      console.log "swith toogle pick"
      # Whiteboard.toogleColorPicker() # TODO

  SessionView
