export interface SpeechRecognitionResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

export interface SpeechRecognitionErrorEventLike {
  error: string
}

export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

export function createBrowserSpeechRecognition(): SpeechRecognitionLike | null {
  const browserWindow = window as SpeechRecognitionWindow
  const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition
  return Recognition ? new Recognition() : null
}

export async function requestMicrophonePermission() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器无法请求麦克风权限，请使用文字输入。')
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  stream.getTracks().forEach((track) => track.stop())
}

export function voiceErrorMessage(error: unknown) {
  const errorName = error instanceof DOMException ? error.name : ''
  if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
    return '麦克风权限未开启，请允许访问或继续使用文字输入。'
  }
  return error instanceof Error
    ? error.message
    : '语音识别未能完成，请继续使用文字输入。'
}
