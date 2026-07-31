<template>
  <ml-toggle-button
    v-model="isFullscreenMode"
    :data="fullScreenBtnData"
    @click="toggleFullScreen"
  />
</template>

<script lang="ts" setup>
import { useFullscreen } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { markComponentConfigRaw } from '../../composable/markComponentConfigRaw'
import { fullScreen } from '../../svg'
import { MlToggleButton } from '../common'
import type { MlIconType, MlToggleButtonData } from '../common/MlToggleButton.vue'

const { t } = useI18n()
const { isFullscreen, toggle: toggleFullScreen } = useFullscreen()

const fullScreenBtnData = computed<MlToggleButtonData>(() => {
  return markComponentConfigRaw({
    onIcon: fullScreen as unknown as MlIconType,
    offIcon: fullScreen as unknown as MlIconType,
    onTooltip: t('main.statusBar.fullScreen.on'),
    offTooltip: t('main.statusBar.fullScreen.off')
  })
})

const isFullscreenMode = computed(() => {
  return isFullscreen.value
})
</script>
