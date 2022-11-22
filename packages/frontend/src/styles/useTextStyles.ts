import { makeStyles } from '@material-ui/core/styles'

const useTextStyles = makeStyles({
  // boldness
  mediumBold: {
    fontWeight: 500,
  },

  // color opacity
  lightFontColor: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  lighterFontColor: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  lightestFontColor: {
    color: 'rgba(255, 255, 255, 0.5)',
  },

  // font size
  smallFont: {
    fontSize: '15px',
  },
  smallerFont: {
    fontSize: '14px',
  },
  smallestFont: {
    fontSize: '12px',
  },

  // font family
  monoFont: {
    fontFamily: 'DM Mono',
  },
})

export default useTextStyles
