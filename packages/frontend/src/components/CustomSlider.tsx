import Slider from '@material-ui/core/Slider'
import { yellow } from '@material-ui/core/colors'
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
    '& .MuiSlider-markLabel[data-index="0"]': {
      marginLeft: '22px',
      color: theme.palette.error.main,
    },
    '& .MuiSlider-markLabel[data-index="1"]': {
      color: yellow[700],
    },
    '& .MuiSlider-mark[data-index="1"]': {
      color: yellow[700],
    },
    '& .MuiSlider-markLabel[data-index="2"]': {
      color: theme.palette.success.main,
    },
    '& .MuiSlider-mark[data-index="2"]': {
      color: theme.palette.success.main,
    },
  },
  track: {
    height: 5,
  },
  mark: {
    height: 5,
  },
}))(Slider)

export default CustomSlider
