class Wordcloud { // eslint-disable-line no-unused-vars
  constructor (element, wordArray, options) {
    this.element = element

    this.word_array = wordArray || []
    this.options = options || {}

    this.sizeGenerator = null
    this.colorGenerator = null

    // Data used internally
    this.data = {
      placed_words: [],
      timeouts: {},
      namespace: null,
      step: null,
      angle: null,
      aspect_ratio: null,
      max_weight: null,
      min_weight: null,
      sizes: [],
      colors: []
    }

    this.DEFAULTS = {
      width: 100,
      height: 100,
      center: { x: 0.5, y: 0.5 },
      steps: 10,
      delay: null,
      shape: 'elliptic',
      classPattern: 'w{n}',
      encodeURI: true,
      removeOverflowing: true,
      afterCloudRender: null,
      autoResize: false,
      colors: null,
      fontSize: null,
      template: null,
      random: Math.random
    }

    this.initialize()
  }

  initialize () {
    // Set/Get dimensions
    if (this.options.width) {
      this.element.style.width = this.options.width + 'px'
    } else {
      this.options.width = parseFloat(window.getComputedStyle(this.element).width) || this.DEFAULTS.width
    }
    if (this.options.height) {
      this.element.style.height = this.options.height + 'px'
    } else {
      this.options.height = parseFloat(window.getComputedStyle(this.element).height) || this.DEFAULTS.height
    }

    // Default options value
    this.options = Object.assign({}, this.DEFAULTS, this.options)

    // Ensure delay
    if (this.options.delay === null) {
      this.options.delay = this.word_array.length > 50 ? 10 : 0
    }

    // Backward compatibility
    if (this.options.center.x > 1) {
      this.options.center.x = this.options.center.x / this.options.width
      this.options.center.y = this.options.center.y / this.options.height
    }

    // Create colorGenerator function from options
    // Direct function
    if (typeof this.options.colors === 'function') {
      this.colorGenerator = this.options.colors
    } else if (Array.isArray(this.options.colors)) { // Array of sizes
      var cl = this.options.colors.length
      if (cl > 0) {
        // Fill the sizes array to X items
        if (cl < this.options.steps) {
          for (var i = cl; i < this.options.steps; i++) {
            this.options.colors[i] = this.options.colors[cl - 1]
          }
        }

        this.colorGenerator = function (weight) {
          return this.options.colors[this.options.steps - weight]
        }
      }
    }

    // Create sizeGenerator function from options
    // Direct function
    if (typeof this.options.fontSize === 'function') {
      this.sizeGenerator = this.options.fontSize
    } else if (Object.prototype.toString.call(this.options.fontSize) === '[object Object]') { // Object with 'from' and 'to'
      this.sizeGenerator = function (width, height, weight) {
        var max = width * this.options.fontSize.from
        var min = width * this.options.fontSize.to
        return Math.round(min + (max - min) * 1.0 / (this.options.steps - 1) * (weight - 1)) + 'px'
      }
    } else if (Array.isArray(this.options.fontSize)) { // Array of sizes
      var sl = this.options.fontSize.length
      if (sl > 0) {
        // Fill the sizes array to X items
        if (sl < this.options.steps) {
          for (var j = sl; j < this.options.steps; j++) {
            this.options.fontSize[j] = this.options.fontSize[sl - 1]
          }
        }

        this.sizeGenerator = function (width, height, weight) {
          return this.options.fontSize[this.options.steps - weight]
        }
      }
    }

    this.data.angle = this.options.random() * 6.28
    this.data.step = (this.options.shape === 'rectangular') ? 18.0 : 2.0
    this.data.aspect_ratio = this.options.width / this.options.height
    this.clearTimeouts()

    // Namespace word ids to avoid collisions between multiple clouds
    this.data.namespace = (this.element.id || Math.floor((Math.random() * 1000000)).toString(36)) + '_word_'

    this.element.classList.add('wordcloud')

    // Container's CSS position cannot be 'static'
    if (window.getComputedStyle(this.element).position === 'static') {
      this.element.style.position = 'relative'
    }

    // Delay execution so that the browser can render the page before the computatively intensive word cloud drawing
    this.createTimeout(this.drawWordCloud.bind(this), 10)

    // Attach window resize event
    if (this.options.autoResize) {
      window.addEventListener('resize', throttle(this.resize, 50, this))
    }
  }

  // Helper function to keep track of timeouts so they can be destroyed
  createTimeout (callback, time) {
    var timeout = setTimeout(function () {
      delete this.data.timeouts[timeout]
      callback()
    }.bind(this), time)
    this.data.timeouts[timeout] = true
  }

  // Destroy all timeouts
  clearTimeouts () {
    Object.keys(this.data.timeouts).forEach(function (key) {
      clearTimeout(key)
    })
    this.data.timeouts = {}
  }

  // Pairwise overlap detection
  overlapping (a, b) {
    if (Math.abs(2.0 * a.left + a.width - 2.0 * b.left - b.width) < a.width + b.width) {
      if (Math.abs(2.0 * a.top + a.height - 2.0 * b.top - b.height) < a.height + b.height) {
        return true
      }
    }
    return false
  }

  // Helper function to test if an element overlaps others
  hitTest (elem) {
    // Check elements for overlap one by one, stop and return false as soon as an overlap is found
    for (var i = 0, l = this.data.placed_words.length; i < l; i++) {
      if (this.overlapping(elem, this.data.placed_words[i])) {
        return true
      }
    }
    return false
  }

  // Initialize the drawing of the whole cloud
  drawWordCloud () {
    var i, l

    this.element.querySelectorAll('*[id^="' + this.data.namespace + '"]').forEach(node => node.remove())

    if (this.word_array.length === 0) {
      return
    }

    // Make sure every weight is a number before sorting
    for (i = 0, l = this.word_array.length; i < l; i++) {
      this.word_array[i].weight = parseFloat(this.word_array[i].weight, 10)
    }

    // Sort word_array from the word with the highest weight to the one with the lowest
    this.word_array.sort(function (a, b) {
      return b.weight - a.weight
    })

    // Kepp trace of bounds
    this.data.max_weight = this.word_array[0].weight
    this.data.min_weight = this.word_array[this.word_array.length - 1].weight

    // Generate colors
    this.data.colors = []
    if (this.colorGenerator) {
      for (i = 0; i < this.options.steps; i++) {
        this.data.colors.push(this.colorGenerator(i + 1))
      }
    }

    // Generate font sizes
    this.data.sizes = []
    if (this.sizeGenerator) {
      for (i = 0; i < this.options.steps; i++) {
        this.data.sizes.push(this.sizeGenerator(this.options.width, this.options.height, i + 1))
      }
    }

    // Iterate drawOneWord on every word, immediately or with delay
    if (this.options.delay > 0) {
      this.drawOneWordDelayed()
    } else {
      for (i = 0, l = this.word_array.length; i < l; i++) {
        this.drawOneWord(i, this.word_array[i])
      }

      if (typeof this.options.afterCloudRender === 'function') {
        this.options.afterCloudRender.call(this.element)
      }
    }
  }

  // Function to draw a word, by moving it in spiral until it finds a suitable empty place
  drawOneWord (index, word) {
    var wordId = this.data.namespace + index

    // option.shape == 'elliptic'

    var angle = this.data.angle

    var radius = 0.0

    // option.shape == 'rectangular'

    var stepsInDirection = 0.0

    var quarterTurns = 0.0

    var weight = Math.floor(this.options.steps / 2)

    var wordSpan

    var wordSize

    var wordStyle

    // Create word attr object
    word.attr = Object.assign({}, word.html, { id: wordId })

    // Linearly map the original weight to a discrete scale from 1 to 10
    // Only if weights are different
    if (this.data.max_weight !== this.data.min_weight) {
      weight = Math.round((word.weight - this.data.min_weight) * 1.0 * (this.options.steps - 1) / (this.data.max_weight - this.data.min_weight)) + 1
    }
    wordSpan = document.createElement('span')
    for (let attribute in word.attr) {
      if (word.attr.hasOwnProperty(attribute)) {
        wordSpan.setAttribute(attribute, word.attr[attribute])
      }
    }

    wordSpan.classList.add('wordcloud-word')

    // Apply class
    if (this.options.classPattern) {
      wordSpan.classList.add(this.options.classPattern.replace('{n}', weight))
    }

    // Apply color
    if (this.data.colors.length) {
      wordSpan.style.color = this.data.colors[weight - 1]
    }

    // Apply color from word property
    if (word.color) {
      wordSpan.style.color = word.color
    }

    // Apply size
    if (this.data.sizes.length) {
      wordSpan.style.fontSize = this.data.sizes[weight - 1]
    }

    // Render using template function if provided.
    if (this.options.template) {
      wordSpan.innerHTML = this.options.template(word)
    } else if (word.link) {
      // Append link if word.link attribute was set
      // If link is a string, then use it as the link href
      if (typeof word.link === 'string') {
        word.link = { href: word.link }
      }

      if (this.options.encodeURI) {
        word.link.href = encodeURI(word.link.href).replace(/'/g, '%27')
      }

      let wordLink = document.createElement('a')
      wordLink.href = word.link.href
      wordLink.textContent = word.text
      wordSpan.appendChild(wordLink)
    } else {
      wordSpan.textContent = word.text
    }

    // Bind handlers to words
    if (word.handlers) {
      wordSpan.on(word.handlers)
    }

    this.element.appendChild(wordSpan)

    wordSize = {
      width: wordSpan.offsetWidth,
      height: wordSpan.offsetHeight
    }
    wordSize.left = this.options.center.x * this.options.width - wordSize.width / 2.0
    wordSize.top = this.options.center.y * this.options.height - wordSize.height / 2.0

    // Save a reference to the style property, for better performance
    wordStyle = wordSpan.style
    wordStyle.position = 'absolute'
    wordStyle.left = wordSize.left + 'px'
    wordStyle.top = wordSize.top + 'px'

    while (this.hitTest(wordSize)) {
      // option shape is 'rectangular' so move the word in a rectangular spiral
      if (this.options.shape === 'rectangular') {
        stepsInDirection++

        if (stepsInDirection * this.data.step > (1 + Math.floor(quarterTurns / 2.0)) * this.data.step * ((quarterTurns % 4 % 2) === 0 ? 1 : this.data.aspect_ratio)) {
          stepsInDirection = 0.0
          quarterTurns++
        }

        switch (quarterTurns % 4) {
          case 1:
            wordSize.left += this.data.step * this.data.aspect_ratio + this.options.random() * 2.0
            break
          case 2:
            wordSize.top -= this.data.step + this.options.random() * 2.0
            break
          case 3:
            wordSize.left -= this.data.step * this.data.aspect_ratio + this.options.random() * 2.0
            break
          case 0:
            wordSize.top += this.data.step + this.options.random() * 2.0
            break
        }
      } else { // Default settings: elliptic spiral shape
        radius += this.data.step
        angle += (index % 2 === 0 ? 1 : -1) * this.data.step

        wordSize.left = this.options.center.x * this.options.width - (wordSize.width / 2.0) + (radius * Math.cos(angle)) * this.data.aspect_ratio
        wordSize.top = this.options.center.y * this.options.height + radius * Math.sin(angle) - (wordSize.height / 2.0)
      }
      wordStyle.left = wordSize.left + 'px'
      wordStyle.top = wordSize.top + 'px'
    }

    // Don't render word if part of it would be outside the container
    if (this.options.removeOverflowing && (
      wordSize.left < 0 || wordSize.top < 0 ||
        (wordSize.left + wordSize.width) > this.options.width ||
        (wordSize.top + wordSize.height) > this.options.height
    )
    ) {
      wordSpan.remove()
      return
    }

    // Save position for further usage
    this.data.placed_words.push(wordSize)

    if (typeof word.afterWordRender === 'function') {
      word.afterWordRender.call(wordSpan)
    }
  }

  // Draw one word then recall the function after a delay
  drawOneWordDelayed (index) {
    index = index || 0

    // if not visible then do not attempt to draw
    if (!(this.element.offsetWidth || this.element.offsetHeight || this.element.getClientRects().length)) {
      this.createTimeout(function () {
        this.drawOneWordDelayed(index)
      }.bind(this), 10)

      return
    }

    if (index < this.word_array.length) {
      this.drawOneWord(index, this.word_array[index])

      this.createTimeout(function () {
        this.drawOneWordDelayed(index + 1)
      }.bind(this), this.options.delay)
    } else {
      if (typeof this.options.afterCloudRender === 'function') {
        this.options.afterCloudRender.call(this.element)
      }
    }
  }

  // Destroy any data and objects added by the plugin
  destroy () {
    if (this.options.autoResize) {
      // @TODO: get access to resize function to unset its handler:
      // $(window).off('resize.' + this.data.namespace)
    }

    this.clearTimeouts()
    this.element.classList.remove('wordcloud')
    this.element.querySelectorAll('*[id^="' + this.data.namespace + '"]').forEach(node => node.remove())
  }

  // Update the list of words
  update (wordArray) {
    this.word_array = wordArray
    this.data.placed_words = []

    this.clearTimeouts()
    this.drawWordCloud()
  }

  resize () {
    var newSize = {
      width: window.getComputedStyle(this.element).width,
      height: window.getComputedStyle(this.element).height
    }

    if (newSize.width !== this.options.width || newSize.height !== this.options.height) {
      this.options.width = newSize.width
      this.options.height = newSize.height
      this.data.aspect_ratio = this.options.width / this.options.height

      this.update(this.word_array)
    }
  }
}

/*
* Apply throttling to a callback
* @param callback {function}
* @param delay {int} milliseconds
* @param context {object|null}
* @return {function}
*/
function throttle (callback, delay, context) {
  var state = {
    pid: null,
    last: 0
  }

  return function () {
    var elapsed = new Date().getTime() - state.last

    var args = arguments

    var that = this

    function exec () {
      state.last = new Date().getTime()
      return callback.apply(context || that, Array.prototype.slice.call(args))
    }

    if (elapsed > delay) {
      return exec()
    } else {
      clearTimeout(state.pid)
      state.pid = setTimeout(exec, delay - elapsed)
    }
  }
}
