// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { parseCadInput } from '@cadflux/cad-import'
import type { DrawingDocument } from '@cadflux/drawing-model'
import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType
} from 'vue'

import { CadFluxViewerCore } from './viewer-core'

export const CadFluxWebViewer = defineComponent({
  name: 'CadFluxWebViewer',
  props: {
    document: {
      type: Object as PropType<DrawingDocument | null | undefined>,
      default: null
    },
    localFile: {
      type: Object as PropType<File | null | undefined>,
      default: null
    },
    background: {
      type: String,
      default: '#0f1419'
    },
    mode: {
      type: [Number, String] as PropType<number | string | undefined>,
      default: undefined
    },
    baseUrl: {
      type: String,
      default: ''
    }
  },
  emits: ['create', 'document-opened'],
  setup(props, { emit }) {
    const hostRef = ref<HTMLElement | null>(null)
    const errorMessage = ref('')
    const isOpening = ref(false)
    const activeLayoutId = ref('')
    const layerVisibility = ref<Record<string, boolean>>({})
    let viewer: CadFluxViewerCore | null = null

    const activeDocument = computed(() => viewer?.document ?? null)
    const layouts = computed(() => activeDocument.value?.layouts ?? [])
    const layers = computed(() => {
      const document = activeDocument.value
      if (!document) return []
      return document.layers.map(layer => ({
        ...layer,
        visible:
          layerVisibility.value[layer.id] ?? layer.visible ?? true
      }))
    })

    function syncStateFromViewer() {
      const document = viewer?.document
      if (!document) {
        activeLayoutId.value = ''
        layerVisibility.value = {}
        return
      }
      activeLayoutId.value = viewer?.activeLayoutId ?? document.layouts[0]?.id ?? ''
      layerVisibility.value = Object.fromEntries(
        document.layers.map(layer => [
          layer.id,
          viewer?.isLayerVisible(layer.id) ?? layer.visible ?? true
        ])
      )
    }

    async function openDocument(document: DrawingDocument) {
      if (!viewer) return
      await viewer.load(document)
      syncStateFromViewer()
      errorMessage.value = ''
      emit('document-opened', {
        fileName: document.source.fileName,
        success: true
      })
    }

    async function openLocalFile(file: File) {
      if (!viewer) return
      const fileName = file.name
      const extension = fileName.split('.').pop()?.toLowerCase()
      if (extension !== 'dxf' && extension !== 'dwg') {
        errorMessage.value = `Unsupported file type for preview: ${fileName}`
        emit('document-opened', { fileName, success: false })
        return
      }

      isOpening.value = true
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const result = await parseCadInput({
          name: file.name,
          format: extension,
          bytes,
          sizeBytes: file.size,
          lastModifiedMs: file.lastModified,
          relativePath:
            'webkitRelativePath' in file && file.webkitRelativePath
              ? String(file.webkitRelativePath)
              : file.name
        })
        await openDocument(result.document)
      } catch (error) {
        errorMessage.value =
          error instanceof Error ? error.message : `Failed to open ${fileName}.`
        emit('document-opened', { fileName, success: false })
      } finally {
        isOpening.value = false
      }
    }

    function handleLayoutChange(nextLayoutId: string) {
      viewer?.setActiveLayout(nextLayoutId)
      syncStateFromViewer()
    }

    function handleLayerToggle(layerId: string, visible: boolean) {
      viewer?.setLayerVisibility(layerId, visible)
      syncStateFromViewer()
    }

    function initialize() {
      if (!hostRef.value) return
      viewer = new CadFluxViewerCore({
        container: hostRef.value,
        background: props.background
      })
      emit('create')
      syncStateFromViewer()
    }

    async function refreshInput() {
      if (!viewer) return
      if (props.document) {
        await openDocument(props.document)
        return
      }
      if (props.localFile) {
        await openLocalFile(props.localFile)
      }
    }

    onMounted(async () => {
      initialize()
      await refreshInput()
    })

    onBeforeUnmount(() => {
      viewer?.destroy()
      viewer = null
    })

    watch(
      () => props.background,
      value => {
        viewer?.setBackground(value)
      }
    )

    watch(
      () => props.document,
      async () => {
        await refreshInput()
      }
    )

    watch(
      () => props.localFile,
      async () => {
        if (!props.document) {
          await refreshInput()
        }
      }
    )

    return () =>
      h(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateRows: 'auto 1fr',
            minHeight: '0',
            height: '100%'
          }
        },
        [
          h(
            'div',
            {
              style: {
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 320px',
                gap: '12px',
                padding: '12px 16px',
                borderBottom: '1px solid rgba(31, 42, 38, 0.08)',
                background: 'rgba(255, 255, 255, 0.72)'
              }
            },
            [
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }
                },
                [
                  h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => viewer?.fitToView(),
                      style: buttonStyle()
                    },
                    'Fit'
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => viewer?.zoomIn(),
                      style: buttonStyle()
                    },
                    'Zoom in'
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => viewer?.zoomOut(),
                      style: buttonStyle()
                    },
                    'Zoom out'
                  ),
                  layouts.value.length > 1
                    ? h('label', { style: { display: 'grid', gap: '4px' } }, [
                        h(
                          'span',
                          {
                            style: {
                              fontSize: '0.8rem',
                              color: 'rgba(31, 42, 38, 0.72)'
                            }
                          },
                          'Layout'
                        ),
                        h(
                          'select',
                          {
                            value: activeLayoutId.value,
                            onChange: (event: Event) =>
                              handleLayoutChange(
                                (event.target as HTMLSelectElement).value
                              ),
                            style: selectStyle()
                          },
                          layouts.value.map(layout =>
                            h(
                              'option',
                              { key: layout.id, value: layout.id },
                              layout.name
                            )
                          )
                        )
                      ])
                    : null,
                  isOpening.value
                    ? h(
                        'div',
                        {
                          style: {
                            color: 'rgba(31, 42, 38, 0.72)',
                            fontSize: '0.9rem'
                          }
                        },
                        'Opening drawing…'
                      )
                    : null,
                  errorMessage.value
                    ? h(
                        'div',
                        {
                          style: {
                            color: '#8b2f2f',
                            fontSize: '0.9rem'
                          }
                        },
                        errorMessage.value
                      )
                    : null
                ]
              ),
              h(
                'div',
                {
                  style: {
                    display: 'grid',
                    gap: '6px',
                    maxHeight: '120px',
                    overflow: 'auto',
                    paddingRight: '4px'
                  }
                },
                layers.value.map(layer =>
                  h(
                    'label',
                    {
                      key: layer.id,
                      style: {
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        gap: '8px',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                        padding: '4px 0'
                      }
                    },
                    [
                      h('input', {
                        type: 'checkbox',
                        checked: layer.visible,
                        onChange: (event: Event) =>
                          handleLayerToggle(
                            layer.id,
                            (event.target as HTMLInputElement).checked
                          )
                      }),
                      h(
                        'span',
                        {
                          style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            minWidth: '0'
                          }
                        },
                        [
                          h('span', {
                            style: {
                              width: '10px',
                              height: '10px',
                              borderRadius: '999px',
                              background: colorToCss(layer.color),
                              border: '1px solid rgba(31, 42, 38, 0.12)',
                              flex: '0 0 auto'
                            }
                          }),
                          h(
                            'span',
                            {
                              style: {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }
                            },
                            layer.name
                          )
                        ]
                      ),
                      h(
                        'span',
                        {
                          style: {
                            color: 'rgba(31, 42, 38, 0.56)'
                          }
                        },
                        layer.locked ? 'locked' : ''
                      )
                    ]
                  )
                )
              )
            ]
          ),
          h('div', {
            ref: hostRef,
            style: {
              width: '100%',
              height: '100%',
              minHeight: '0',
              position: 'relative',
              background: props.background
            }
          })
        ]
      )
  }
})

function colorToCss(color: DrawingDocument['layers'][number]['color']): string {
  if (!color) return '#ffffff'
  const alpha = color.a == null ? 1 : color.a
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}

function buttonStyle() {
  return {
    borderRadius: '12px',
    border: '1px solid rgba(31, 42, 38, 0.12)',
    padding: '8px 12px',
    background: '#fff',
    cursor: 'pointer'
  }
}

function selectStyle() {
  return {
    minWidth: '180px',
    borderRadius: '12px',
    border: '1px solid rgba(31, 42, 38, 0.12)',
    padding: '8px 12px',
    background: '#fff'
  }
}
