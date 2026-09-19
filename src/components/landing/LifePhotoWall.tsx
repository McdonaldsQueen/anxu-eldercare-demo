import { useState } from 'react'
import { lifePhotos } from '../../data/lifePhotos'

export function LifePhotoWall() {
  const [paused, setPaused] = useState(false)

  return (
    <section className="life-section" aria-labelledby="life-title">
      <div className="life-section__heading">
        <h2 id="life-title">我们看见的，不只是风险。是一个人正在过的生活。</h2>
        <button
          className="life-section__pause"
          type="button"
          aria-pressed={paused}
          aria-label={paused ? '继续照片流动' : '暂停照片流动'}
          onClick={() => setPaused((current) => !current)}
        >{paused ? '继续流动' : '暂停流动'}</button>
      </div>
      <div className={`life-wall${paused ? ' life-wall--paused' : ''}`}>
        <div className="life-wall__track">
          {/* Equal groups include the trailing gap, so -50% is exactly one cycle. */}
          {[false, true].map((duplicate) => (
            <div className="life-wall__group" key={String(duplicate)} aria-hidden={duplicate || undefined}>
              {lifePhotos.map((photo) => (
                <figure className={`life-photo life-photo--${photo.format}`} key={photo.file}>
                  <img
                    src={`${import.meta.env.BASE_URL}images/life/${photo.file}`}
                    alt={duplicate ? '' : photo.alt}
                    width={photo.format === 'landscape' ? 1000 : 667}
                    height={photo.format === 'landscape' ? 667 : 1000}
                    style={{ objectPosition: photo.position ?? '50% 50%' }}
                    decoding="async"
                    draggable={false}
                  />
                </figure>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
