import Slider from '@material-ui/core/Slider'
import { withStyles } from '@material-ui/core/styles'

const CustomSlider = withStyles((theme) => ({
  thumb: {
    width: '3px',
    borderRadius: '20%',
    marginLeft: 0,
    height: 15,
  },
  markLabel: {
    fontSize: '.7rem',
  },
  rail: {
    height: 5,
  },
  root: {
    height: 5,
    color: theme.palette.text.secondary,
  },
  track: {
    height: 5,
  },
  mark: {
    height: 5,
  },
}))(Slider)

export default CustomSlider
