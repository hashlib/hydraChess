import { showLoggedTwiceModal } from './logged_twice.js'
import { Timer, ClockPair } from './clock.js'

;(function() {
  var board = null
  var $board = $('#board')
  var color = null

  var game = null
  var gameFinished = null

  var rating = null

  var $movesList = $('#moves_list')
  var movesArray = null
  var moveIndx = null
  // Last time we scrolled moves list to this move
  var moveIndxLastUpdate = null

  var animation = false

  var $modal = $('#game_results_modal')

  var $firstMoveNotification = $('#first_move_notification')
  var firstMoveTimer = new Timer('first_move_seconds')

  var $oppDisconnectedNotification = $('#opp_disconnected_notification')
  var oppDisconnectedTimer = new Timer('reconnect_wait_seconds')

  var $buttonsContainer = $('#buttons_container')
  var $drawBtn = $('#draw_btn')
  var $resignBtn = $('#resign_btn')

  var clockPair = new ClockPair(['clock_a', 'clock_b'], 0)
  clockPair.hide()

  /* -- GAME INFO RELATED FUNCTIONS -- */
  function getFullmoveNumber() {
    var fen = game.fen()
    var fullmoveNumber = parseInt(fen.split(' ')[5])
    return fullmoveNumber
  }

  function getPosByPiece(piece) {
    var board = game.board()
    var bConc = [].concat(...board)
    var indexes = bConc.map((p, indx) => {
      if (p !== null && p.type === piece.type && p.color === piece.color) {
        return indx
      }
    }).filter(val => val !== undefined)

    var positions = indexes.map((cellIndex) => {
      const row = 'abcdefgh'[cellIndex % 8]
      const col = Math.ceil((64 - cellIndex) / 8)
      return row + col
    })

    return positions
  }
  /* -- GAME INFO RELATED FUNCTIONS -- */

  /* -- SOUNDS -- */
  var moveSound = new Howl({
      src: ['/static/sounds/move.mp3']
  })
  var drawOfferSound = new Howl({
      src: ['/static/sounds/draw_offer.mp3']
  })

  var gameStartedSound = new Howl({
      src: ['/static/sounds/game_started.mp3']
  })

  var gameEndedSound = new Howl({
      src: ['/static/sounds/game_ended.mp3']
  })
  /* -- SOUNDS -- */

  function setPlayersInfo(infoA, infoB) {
    $('#info_a').html(`<a href="/user/${infoA.nickname}" class="nickname">${infoA.nickname}</a> (${infoA.rating})`)
    $('#info_b').html(`<a href="/user/${infoB.nickname}" class="nickname">${infoB.nickname}</a> (${infoB.rating})`)
  }

  function setResults(result) {
    var whiteResult = null
    var blackResult = null
    if (result === '1-0') {
      whiteResult = 'won'
      blackResult = 'lost'
    } else if (result === '0-1') {
      whiteResult = 'lost'
      blackResult = 'won'
    } else if (result === '1/2-1/2')  {
      whiteResult = blackResult = 'draw'
    } else if (result === '-') {
      whiteResult = blackResult = 'canceled'
    }

    if (board.orientation() === 'white') {
      $('#info_a').append(` <b>(${blackResult})</b>`)
      $('#info_b').append(` <b>(${whiteResult})</b>`)
    } else {
      $('#info_a').append(` <b>(${whiteResult})</b>`)
      $('#info_b').append(` <b>(${blackResult})</b>`)
    }
  }

  /* -- HIGHLIGHTS RELATED FUNCTIONS -- */
  function removeHighlights() {
    $board.find('.square-55d63')
      .removeClass('highlight-move-from')
      .removeClass('highlight-move-to')
      .removeClass('highlight-check')
  }

  function highlightLastMove() {
    if (game === null || moveIndx < 0) {
      return
    }

    var move = game.undo()
    game.move(move)

    $board.find('.square-' + move.from).addClass('highlight-move-from')
    $board.find('.square-' + move.to).addClass('highlight-move-to')

    if (game.in_check()) {
      var piece = {type: 'k', color: game.turn()}
      var pos = getPosByPiece(piece)[0]
      $board.find('.square-' + pos).addClass('highlight-check')
    }
  }

  /* -- HIGHLIGHTS RELATED FUNCTIONS -- */
  function onDragStart(source, piece, position, orientation) {
    if (gameFinished || color !== piece[0]) return false
    if (moveIndx + 1 !== movesArray.length) {
      moveToEnd()
      return false
    }
  }

  function onDrop(source, target) {
    if (color !== game.turn()) return 'snapback'

    var move = game.move({
      from: source,
      to: target,
      promotion: 'q' // TODO
    })

    // illegal move
    if (move === null) return 'snapback'

    $firstMoveNotification.addClass('is-hidden')
    $firstMoveNotification.removeClass('animate__animated animate__fadeIn')
    firstMoveTimer.stop()

    if (!game.game_over()) {
      moveSound.play()
    }

    removeHighlights()
    highlightLastMove()

    game.undo()

    sio.emit('make_move', {'san': move.san, 'game_id': gameId})

    declineDrawOfferLocally()
  }

  function onGameStarted(data) {
    if (data.moves !== '') {
      movesArray = data.moves.split(',')
    }    else {
      movesArray = []
    }

    moveIndx = movesArray.length - 1

    game = new Chess()
    movesArray.forEach(function(move, index) {
      pushToMovesList(move, index)
      game.move(move)
    })

    board.position(game.fen())

    if (data.result === undefined) {
      gameStartedSound.play()
      clockPair.setTimes(data.black_clock, data.white_clock)
      if (game.turn() === 'w' && getFullmoveNumber() !== 1) {
        clockPair.setWorkingClock(1)
      }
      clockPair.show()
      gameFinished = false
    }    else {
      gameFinished = true
    }

    if (data.is_player) {
      color = data.color
      if (color === 'w') {
        rating = data['white_user']['rating']
        board.orientation('white')
      } else {
        if (data.result === undefined) {
          clockPair.rotate()
        }
        rating = data['black_user']['rating']
        board.orientation('black')
      }

      // Show draw and resign buttons.
      if (data.result === undefined) {
        $buttonsContainer.removeClass('is-hidden')
        $drawBtn.prop('accept', false)
        $drawBtn.prop('disabled', !data.can_send_draw_offer)
      }
    }

    highlightLastMove()

    if (board.orientation() === 'white') {
        setPlayersInfo(data.black_user, data.white_user)
    } else {
        setPlayersInfo(data.white_user, data.black_user)
    }

    if (data.result !== undefined) {
      setResults(data.result)
    }

    if (movesArray.length < 2) {
      $resignBtn.html('Cancel game')
    } else {
      $resignBtn.html('Resign')
    }

    // If game is started, start clocks
    if (movesArray.length !== 0) {
      clockPair.start()
    }
 }

 function onGameUpdated(data) {
    clockPair.setTimes(data.black_clock, data.white_clock)

    // There won't be animation, because we already updated board position
    // before. animation = true will block moveToEnd() call.
    if (game.turn() === color) {
      animation = false
    }

    movesArray.push(data.san)
    pushToMovesList(data.san, moveIndx + 1)
    moveToEnd(false)
    if (!clockPair.works) clockPair.start()
    else clockPair.toggle()

    removeHighlights()
    highlightLastMove()

    if (movesArray.length < 2) {
      $resignBtn.text('Cancel game')
    } else {
      $resignBtn.text('Resign')
    }

    // Checking in order to do not do this twice
    if (game.turn() === color && !game.game_over()) {
      moveSound.play()
    }

    $drawBtn.prop('disabled', false)
  }

  function onGameEnded(data) {
    $buttonsContainer.addClass('is-hidden')

    clockPair.stop()
    setResults(data.result)

    if (color === null) {
      // Do not do next things, If we are spectators.
      return
    }

    $firstMoveNotification.addClass('is-hidden')
    $firstMoveNotification.removeClass('animate__animated animate__fadeIn')
    firstMoveTimer.stop()

    $oppDisconnectedNotification.addClass('is-hidden')
    $oppDisconnectedNotification.removeClass('animate__animated animate__fadeIn')
    oppDisconnectedTimer.stop()

    var ratingDelta = data.rating_deltas[color]
    if (ratingDelta > 0) {
      ratingDelta = '+' + ratingDelta
    }
    rating += parseInt(ratingDelta)

    $('#game_result_container')
      .append(`${data.reason}<br />Your new rating: ${rating} (${ratingDelta})`)
    $modal.addClass('animate__animated animate__fadeIn is-active')

    gameEndedSound.play()
    gameFinished = true
  }

  function onFirstMoveWaiting(data) {
    if ($oppDisconnectedNotification.hasClass('is-hidden') === false) {
      return
    }

    var waitTime = data.wait_time

    firstMoveTimer.stop()
    firstMoveTimer.setTime(waitTime)
    firstMoveTimer.start()
    $firstMoveNotification.toggleClass('animate__animated animate__fadeIn is-hidden')
  }

  function onOppDisconnected(data) {
    // In order to do not make overlapping notifications.
    if ($firstMoveNotification.hasClass('is-hidden') === false) {
      return
    }

    var waitTime = data.wait_time

    oppDisconnectedTimer.stop()
    oppDisconnectedTimer.setTime(waitTime)
    oppDisconnectedTimer.start()
    $oppDisconnectedNotification.toggleClass('animate__animated animate__fadeIn is-hidden')
    $oppDisconnectedNotification.fadeIn()
  }

  function onOppReconnected() {
    $oppDisconnectedNotification.addClass('is-hidden')
    $oppDisconnectedNotification.removeClass('animate__animated animate__fadeIn')
    oppDisconnectedTimer.stop()
  }

  function onDrawOffer() {
    $drawBtn.prop('accept', true)
    $drawBtn.addClass('is-warning')
    $drawBtn.addClass('has-text-weight-bold')
    $drawBtn.text('Accept draw')
    drawOfferSound.play()
  }

  function acceptDrawOffer() {
    sio.emit('accept_draw_offer')
  }

  function makeDrawOffer() {
    sio.emit('make_draw_offer')
    $drawBtn.prop('disabled', true)
  }

  function declineDrawOfferLocally() {
    $drawBtn.prop('accept', false)
    $drawBtn.removeClass('is-warning')
    $drawBtn.removeClass('has-text-weight-bold')
    $drawBtn.text('Draw')
  }

  function updateBoardSize() {
    var viewportWidth = window.innerWidth
    var viewportHeight = window.innerHeight

    var containerSize
    if (viewportWidth < 1024) {
      if ($('#clock_a').css('display') === 'none') {
        containerSize = Math.floor(
          Math.min(viewportWidth / 10 * 8, viewportHeight / 10 * 8)
        )
      } else {
        containerSize = Math.floor(
          Math.min((viewportWidth - $('#clock_a').width()) / 10 * 8,
                    viewportHeight / 10 * 8)
        )
      }
    } else {
      containerSize = Math.floor(
        Math.min((viewportWidth - $('#right_container').width()) / 10 * 8,
                  viewportHeight / 10 * 8)
      )
    }

    containerSize -= containerSize % 8 - 1
    $board.width(containerSize)
    $board.height(containerSize)
    board.resize()
    highlightLastMove()
  }

  // should be called before EVERY animation
  function blockAnimation() {
    animation = true
    setTimeout(
      function() {
        animation = false
      },
      config.moveSpeed + 30
    )
  }

  var config = {
    pieceTheme: '../static/img/pieces/{piece}.svg',
    draggable: true,
    onDragStart: onDragStart,
    onDrop: onDrop,
    onChange: blockAnimation,
    highlight: true,
    highlight1: 'highlight-from',
    highlight2: 'highlight-to',
    moveSpeed: 200
  }

  board = Chessboard('board', config)

  $(window).on('load', updateBoardSize)
  $(window).resize(updateBoardSize)

  $(window).on('load', updateMovesListScrollLevel)
  $(window).resize(updateMovesListScrollLevel)

  var href = window.location.href
  var gameId = href.slice(href.lastIndexOf('/') + 1)

  var sio = io({
    transports: ['websocket'],
    upgrade: false,
    query: {
      request_type: 'game',
      game_id: gameId
    }
  })

  sio.on('game_started', onGameStarted)
  sio.on('game_updated', onGameUpdated)
  sio.on('game_ended', onGameEnded)
  sio.on('redirect', function(data) {
    window.location.href = data.url
  })
  sio.on('first_move_waiting', onFirstMoveWaiting)
  sio.on('opp_disconnected', onOppDisconnected)
  sio.on('opp_reconnected', onOppReconnected)
  sio.on('draw_offer', onDrawOffer)
  sio.on('logged_twice', showLoggedTwiceModal)

  $drawBtn.on('click', function(e) {
    if ($drawBtn.prop('accept')) {
      acceptDrawOffer()
    } else {
      makeDrawOffer()
    }
  })

  $resignBtn.on('click', function(e) {
    sio.emit('resign')
  })

  function isVisibleInMovesList($move) {
    var movesListTop = $movesList.offset().top
    var movesListBottom = movesListTop + $movesList.height()

    var moveTop = $move.offset().top
    var moveBottom = moveTop + $move.height()

    return movesListTop <= moveTop && moveBottom <= movesListBottom
  }

  function moveBack() {
    if (moveIndx >= 0 && !animation) {
      $movesList.find(`#move_${moveIndx}`).removeClass('halfmove-active')
      moveIndx -= 1
      if ($movesList.css('display') !== 'none') {
        moveIndxLastUpdate = moveIndx
      }
      game.undo()
      board.position(game.fen())
      var $moveCell = $movesList.find(`#move_${moveIndx}`)
      $moveCell.addClass('halfmove-active')

      // move to the previous row, if outside the moves list
      if (moveIndx >= 0 && !isVisibleInMovesList($moveCell)) {
        $movesList.scrollTop($movesList.scrollTop() - $moveCell.height())
      }

      moveSound.play()

      removeHighlights()
      highlightLastMove()
    }
  }

  function moveForward() {
    if (moveIndx + 1 !== movesArray.length && !animation) {
      $movesList.find(`#move_${moveIndx}`).removeClass('halfmove-active')
      moveIndx += 1
      if ($movesList.css('display') !== 'none') {
        moveIndxLastUpdate = moveIndx
      }
      game.move(movesArray[moveIndx])
      board.position(game.fen())
      var $moveCell = $movesList.find(`#move_${moveIndx}`)
      $moveCell.addClass('halfmove-active')

      // move to the next row, if outside the moves list
      if (!isVisibleInMovesList($moveCell)) {
        $movesList.scrollTop($movesList.scrollTop() + $moveCell.height())
      }

      moveSound.play()

      removeHighlights()
      highlightLastMove()
    }
  }

  function moveToBegin() {
    if (moveIndx !== -1 && !animation) {
      $movesList.find(`#move_${moveIndx}`).removeClass('halfmove-active')
      moveIndx = -1
      if ($movesList.css('display') !== 'none') {
        moveIndxLastUpdate = moveIndx
      }

      game.reset()
      board.position(game.fen())
      $movesList.scrollTop(0)

      moveSound.play()

      removeHighlights()
    }
  }

  function moveToEnd(playSound=true) {
    if (moveIndx !== movesArray.length - 1 && !animation) {
      $movesList.find(`#move_${moveIndx}`).removeClass('halfmove-active')
      while (moveIndx + 1 !== movesArray.length) {
        moveIndx += 1
        game.move(movesArray[moveIndx])
      }

      if ($movesList.css('display') !== 'none') {
        moveIndxLastUpdate = moveIndx
      }

      board.position(game.fen())
      $movesList.find(`#move_${moveIndx}`).addClass('halfmove-active')
      $movesList.scrollTop($movesList[0].scrollHeight)

      if (playSound) {
        moveSound.play()
      }

      removeHighlights()
      highlightLastMove()
    }
  }

  function updateMovesListScrollLevel() {
    if (window.innerWidth < 1024) {
      // The moves list is hidden
      return
    }
    if (moveIndx === null || moveIndx === -1) {
      return
    }

    var $moveCell = $movesList.find(`#move_${moveIndx}`)
    if (isVisibleInMovesList($moveCell)) {
      return
    }

    var row = Math.trunc(moveIndx / 2)

    var resultScroll
    if (moveIndxLastUpdate > moveIndx) {
      resultScroll =
        Math.min($movesList[0].scrollHeight, row * $moveCell.height())
    } else {
      resultScroll =
        Math.min($movesList[0].scrollHeight, (row - 2) * $moveCell.height())
    }
    $movesList.scrollTop(resultScroll)
    moveIndxLastUpdate = moveIndx
  }

  $(document).keydown(function(e) {
    if (e.keyCode === 37) moveBack() // left arrow
    else if (e.keyCode === 39) moveForward()  // right arrow
    else if (e.keyCode === 38) moveToBegin()  // up arrow
    else if (e.keyCode === 40) moveToEnd()  // down arrow
  })

  function pushToMovesList(move, indx) {
    $movesList.find('.halfmove').removeClass('halfmove-active')
    if (indx % 2 === 0) {
      $movesList.append(`<div class='columns move mx-0 my-0 px-0 py-0'>
                          <div id='move_${indx}'
                               class='column is-half mx-0 my-0 pl-3 py-0 halfmove halfmove-active'>
                            ${move}
                          </div>
                          <div class='column is-half mx-0 my-0 pl-3 py-0'></div>
                         </div>`)
    } else {
      var $moveCell = $movesList.children().last().children().last()
      $moveCell.attr('id', `move_${indx}`)
      $moveCell.addClass('halfmove halfmove-active')
      $moveCell.append(move)
    }
    $movesList.scrollTop($movesList[0].scrollHeight)
  }

  $('body').on('click', '.halfmove', function() {
    $movesList.find(`#move_${moveIndx}`).removeClass('halfmove-active')
    var newMoveIndx = parseInt(this.id.slice(5))
    if (newMoveIndx === moveIndx) {
      return
    }

    while (newMoveIndx < moveIndx) {
      moveIndx -= 1
      game.undo()
    }
    while (newMoveIndx > moveIndx) {
      moveIndx += 1
      game.move(movesArray[moveIndx])
    }
    board.position(game.fen())
    $movesList.find(`#move_${moveIndx}`).addClass('halfmove-active')
    removeHighlights()
    highlightLastMove()
    moveSound.play()
  })

  var $newGameBtn = $('#new_game_btn')
  var $stopSearchBtn = $('#stop_search_btn')

  $newGameBtn.on('click', function(e) {
    e.preventDefault()
    sio.emit('search_game', {game_id: gameId})
    $newGameBtn.addClass('is-hidden')
    $stopSearchBtn.removeClass('is-hidden')
  })

  $stopSearchBtn.on('click', function(e) {
    e.preventDefault()
    sio.emit('cancel_search')
    $newGameBtn.removeClass('is-hidden')
    $stopSearchBtn.addClass('is-hidden')
  })

  // Hide modal on press out of it
  $('.modal-background').on('click', function() {
    $modal.addClass('animate__fadeOut')
    setTimeout(
      function() {
        $modal
          .removeClass('animate__animated animate__fadeOut animate__fadeIn is-active')
      },
      110
    )
    // Stop search, if modal is closed.
    if ($stopSearchBtn.hasClass('is-hidden')) {
      sio.emit('cancel_search')
    }
  })
})()
