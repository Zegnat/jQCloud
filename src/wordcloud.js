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
      step: (this.options.shape === 'rectangular') ? 18.0 : 2.0,
      angle: this.options.random() * 6.28,
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
    var angle = this.data.angle
    var radius = 0.0
    var stepsInDirection = 0.0
    var quarterTurns = 0.0

    const wordSpan = document.createElement('span')
    wordSpan.id = this.data.namespace + index
    wordSpan.classList.add('wordcloud-word')
    wordSpan.textContent = word.text
    wordSpan.style.fontSize = this.options.size(word.weight)
    console.log('fontSize', word.weight, this.options.size(word.weight))
    this.wrapper.appendChild(wordSpan)

    const wordSize = {
      width: wordSpan.offsetWidth,
      height: wordSpan.offsetHeight
    }
    wordSize.left = this.options.center.x * this.width - wordSize.width / 2.0
    wordSize.top = this.options.center.y * this.height - wordSize.height / 2.0

    // Save a reference to the style property, for better performance
    const wordStyle = wordSpan.style
    wordStyle.position = 'absolute'
    wordStyle.left = wordSize.left + 'px'
    wordStyle.top = wordSize.top + 'px'

    while (this.overlapsOthers(wordSpan.getBoundingClientRect(), this.data.placed_words)) {
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

        wordSize.left = this.options.center.x * this.width - (wordSize.width / 2.0) + (radius * Math.cos(angle)) * this.data.aspect_ratio
        wordSize.top = this.options.center.y * this.height + radius * Math.sin(angle) - (wordSize.height / 2.0)
      }
      wordStyle.left = wordSize.left + 'px'
      wordStyle.top = wordSize.top + 'px'
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
}

Wordcloud.prototype.DEFAULTS = {
  center: { x: 0.5, y: 0.5 },
  shape: 'elliptic',
  random: Math.random,
  size: weight => 0.5 + weight + 'em'
}
