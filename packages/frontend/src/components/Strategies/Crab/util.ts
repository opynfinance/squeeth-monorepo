export const makeItCrabRain = function () {
  //clear out everything
  const rainRoot = document.getElementById('rain')
  const rainFront = document.createElement('div')
  rainFront.id = 'rain-front'
  const rainBack = document.createElement('div')
  rainBack.id = 'rain-back'

  rainRoot?.appendChild(rainFront)
  rainRoot?.appendChild(rainBack)

  let increment = 0
  let drops = ''
  let backDrops = ''

  while (increment < 100) {
    //couple random numbers to use for various randomizations
    //random number between 98 and 1
    const randoHundo = Math.floor(Math.random() * (100 - 1 + 1) + 1)
    //random number between 5 and 2
    const randoFiver = Math.floor(Math.random() * (5 - 2 + 1) + 2)
    //increment
    increment += randoFiver

    const emojis = ['🐱', '🦀']
    const randEmoji = emojis[Math.floor(Math.random() * emojis.length)]
    //add in a new raindrop with various randomizations to certain CSS properties
    drops +=
      '<div class="drop" style="left: ' +
      increment +
      '%; bottom: ' +
      (randoFiver + randoFiver - 1 + 100) +
      '%; animation-delay: 0.' +
      randoHundo +
      's; animation-duration: 2.' +
      randoHundo +
      's;"><div class="stem" style="animation-delay: 0.' +
      randoHundo +
      's; animation-duration: 0.5' +
      randoHundo +
      's;"></div>' +
      randEmoji +
      '<div class="splat" style="animation-delay: 0.' +
      randoHundo +
      's; animation-duration: 0.5' +
      randoHundo +
      's;"></div></div>'
    backDrops +=
      '<div class="drop" style="right: ' +
      increment +
      '%; bottom: ' +
      (randoFiver + randoFiver - 1 + 100) +
      '%; animation-delay: 0.' +
      randoHundo +
      's; animation-duration: 2.' +
      randoHundo +
      's;"><div class="stem" style="animation-delay: 0.' +
      randoHundo +
      's; animation-duration: 0.5' +
      randoHundo +
      's;"></div>' +
      randEmoji +
      '<div class="splat" style="animation-delay: 0.' +
      randoHundo +
      's; animation-duration: 0.5' +
      randoHundo +
      's;"></div></div>'
  }

  if (document.getElementById('rain-front')) {
    document.getElementById('rain-front')!.innerHTML = drops
  }
  if (document.getElementById('rain-back')) {
    document.getElementById('rain-back')!.innerHTML = backDrops
  }

  setTimeout(stopRain, 10000)
}

export const stopRain = () => {
  document.getElementById('rain')!.innerHTML = ''
}
