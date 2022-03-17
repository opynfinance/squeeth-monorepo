import React from 'react'
import isEmpty from 'lodash/isEmpty'
import isString from 'lodash/isString'

function getDisplayName(type) {
  return (
    type.displayName ||
    type.name ||
    (type.type && getDisplayName(type.type)) ||
    (type.render && getDisplayName(type.render)) ||
    (isString(type) ? type : null)
  )
}

const origCreateElement = React.createElement

let renderCount = {}

if (process.env.NODE_ENV === 'development') {
  const ignoreNames = ['HiddenJs', '_class', 'o']

  React.createElement = function (orgComp, ...params) {
    if (typeof orgComp === 'function') {
      const displayName = getDisplayName(orgComp)
      if (displayName && !ignoreNames.includes(displayName) && !displayName.startsWith('With')) {
        if (renderCount[displayName]) {
          renderCount[displayName]++
        } else {
          renderCount[displayName] = 1
        }
      }
    }

    const element = origCreateElement.apply(React, [orgComp, ...params])

    return element
  }
}

export default function useRenderCounter(logRenderCountKey, resetRenderCountKey) {
  React.useEffect(() => {
    const keydownHandler = (event) => {
      if (process.env.NODE_ENV !== 'development') {
        return
      }

      if (event.key == logRenderCountKey && event.ctrlKey) {
        console.clear()
        if (isEmpty(renderCount)) {
          console.log('There was no rerender after reset.')
        } else {
          console.table(renderCount)
        }
      }

      if (event.key == resetRenderCountKey && event.ctrlKey) {
        console.clear()
        console.log('Render counts has been reset.')
        renderCount = {}
      }
    }

    document.addEventListener('keydown', keydownHandler)

    return () => {
      document.removeEventListener('keydown', keydownHandler)
    }
  }, [logRenderCountKey, resetRenderCountKey])
}
