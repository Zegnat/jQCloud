'use strict'

class Wordcloud {
  constructor (wrapper, words, options) {
    this.wrapper = wrapper

    // Get canvas size
    this.width = parseFloat(window.getComputedStyle(this.wrapper).width)
    this.height = parseFloat(window.getComputedStyle(this.wrapper).height)

    // Options
    this.options = Object.assign({}, this.DEFAULTS, options)

    // Data used internally
    this.data = {
      namespace: (this.wrapper.id || Math.floor((Math.random() * 1000000)).toString(36)) + '_word_',
      aspect_ratio: this.width / this.height,
      placed_words: []
    }

    // Container's CSS position cannot be 'static'
    if (window.getComputedStyle(this.wrapper).position === 'static') {
      this.wrapper.style.position = 'relative'
    }

    // Normalise words and start drawing
    words = words.map(({ text, weight }) => ({ text, weight: parseFloat(weight, 10) }))
    words.sort((a, b) => b.weight - a.weight)
    let minWeight = words[words.length - 1].weight
    let maxWeight = words[0].weight
    this.words = words.map(({ text, weight }) => ({ text, weight: (weight - minWeight) / (maxWeight - minWeight) }))
    this.words.forEach(this.drawOneWord.bind(this))
  }

  // Function to draw a word, by moving it in spiral until it finds a suitable empty place
  drawOneWord (word, index) {
    const wordSpan = document.createElement('span')
    wordSpan.id = this.data.namespace + index
    wordSpan.textContent = word.text
    wordSpan.style.fontSize = this.options.size(word.weight)
    this.wrapper.appendChild(wordSpan)

    word.index = index
    word.width = wordSpan.offsetWidth
    word.height = wordSpan.offsetHeight
    word.left = 0.5 * this.width - word.width / 2.0
    word.top = 0.5 * this.height - word.height / 2.0

    // Save a reference to the style property, for better performance
    const wordStyle = wordSpan.style
    wordStyle.position = 'absolute'
    wordStyle.left = word.left + 'px'
    wordStyle.top = word.top + 'px'

    const state = {}
    while (this.overlapsOthers(wordSpan.getBoundingClientRect(), this.data.placed_words)) {
      let output = this.options.spread({ ...word, index }, { height: this.height, width: this.width }, this.options, state)
      word.left = output.left
      word.top = output.top
      wordStyle.left = word.left + 'px'
      wordStyle.top = word.top + 'px'
    }

    // Save position for further usage
    this.data.placed_words.push(wordSpan.getBoundingClientRect())
  }

  overlapsOthers (me, others) {
    for (let other of others) {
      if (!(me.right < other.left || me.left > other.right || me.bottom < other.top || me.top > other.bottom)) {
        return true
      }
    }
    return false
  }

  static moveRectangular(word, canvas, options, state) {
    const step = 18.0
    if (Object.keys(state).length === 0) {
      state.stepsInDirection = 0
      state.quarterTurns = 0
      state.aspect_ratio = canvas.width / canvas.height
    }
    state.stepsInDirection += 1

    if (state.stepsInDirection * step > (1 + Math.floor(state.quarterTurns / 2.0)) * step * ((state.quarterTurns % 4 % 2) === 0 ? 1 : state.aspect_ratio)) {
      state.stepsInDirection = 0
      state.quarterTurns += 1
    }

    switch (state.quarterTurns % 4) {
      case 1:
        word.left += step * state.aspect_ratio + options.random() * 2.0
        break
      case 2:
        word.top -= step + options.random() * 2.0
        break
      case 3:
        word.left -= step * state.aspect_ratio + options.random() * 2.0
        break
      case 0:
        word.top += step + options.random() * 2.0
        break
    }

    return word
  }

  static moveElliptic(word, canvas, options, state) {
    const step = 2.0
    if (Object.keys(state).length === 0) {
      state.radius = 0.0
      state.angle = options.random() * 6.28
      state.aspect_ratio = canvas.width / canvas.height
    }
    state.radius += step
    state.angle += (word.index % 2 === 0 ? 1 : -1) * step

    return {
      left: 0.5 * canvas.width - (word.width / 2.0) + (state.radius * Math.cos(state.angle)) * state.aspect_ratio,
      top: 0.5 * canvas.height + state.radius * Math.sin(state.angle) - (word.height / 2.0)
    }
  }
}

Wordcloud.prototype.DEFAULTS = {
  spread: Wordcloud.moveElliptic,
  random: Math.random,
  size: weight => 0.5 + weight + 'em'
}
