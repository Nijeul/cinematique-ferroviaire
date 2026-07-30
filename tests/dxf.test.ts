import { describe, expect, it } from 'vitest'
import { lirePolylignesDxf, preparerVoiesDxf } from '../src/geometry/dxf.ts'

// DXF d'essai : une LWPOLYLINE de trois sommets sur le calque VOIES, une
// LINE sur le calque CLOTURE, une SPLINE (ignorée), un POLYLINE ancien
// format avec deux VERTEX.
const DXF_ESSAI = [
  '0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES',
  '0', 'LWPOLYLINE', '8', 'VOIES', '90', '3',
  '10', '100', '20', '200', '10', '400', '20', '200', '10', '700', '20', '350',
  '0', 'LINE', '8', 'CLOTURE', '10', '0', '20', '0', '11', '50', '21', '0',
  '0', 'SPLINE', '8', 'VOIES',
  '0', 'POLYLINE', '8', 'VOIES',
  '0', 'VERTEX', '8', 'VOIES', '10', '100', '20', '500',
  '0', 'VERTEX', '8', 'VOIES', '10', '300', '20', '500',
  '0', 'SEQEND',
  '0', 'ENDSEC',
  '0', 'EOF',
].join('\n')

describe('lirePolylignesDxf', () => {
  const lecture = lirePolylignesDxf(DXF_ESSAI)

  it('regroupe les polylignes par calque', () => {
    expect(Object.keys(lecture.calques).sort()).toEqual(['CLOTURE', 'VOIES'])
    expect(lecture.calques['VOIES']).toHaveLength(2)
    expect(lecture.calques['CLOTURE']).toHaveLength(1)
  })

  it('lit les sommets d’une LWPOLYLINE et d’un POLYLINE ancien format', () => {
    expect(lecture.calques['VOIES'][0]).toEqual([[100, 200], [400, 200], [700, 350]])
    expect(lecture.calques['VOIES'][1]).toEqual([[100, 500], [300, 500]])
  })

  it('compte les entités ignorées pour prévenir l’utilisateur', () => {
    expect(lecture.entitesIgnorees).toBe(1)
  })
})

describe('preparerVoiesDxf', () => {
  it('applique l’échelle et recentre sur l’origine', () => {
    const voies = preparerVoiesDxf([[[1000, 2000], [4000, 2000]]], {
      echelle: 0.001,
      recentrer: true,
    })
    expect(voies).toEqual([[[0, 0], [3, 0]]])
  })

  it('fusionne les points quasi confondus', () => {
    const voies = preparerVoiesDxf([[[0, 0], [0.01, 0], [50, 0]]], {
      echelle: 1,
      recentrer: false,
    })
    expect(voies[0]).toHaveLength(2)
  })
})
