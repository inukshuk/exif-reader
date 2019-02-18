'use strict'

const {
  readUInt16,
  readUInt32,
  readString,
  readValues
} = require('./util')

const {
  isDateTag,
  parseDate
} = require('./date')

const TYPE_SIZE = [1, 1, 2, 4, 8, 1, 1, 2, 4, 8]

class IFD {
  static get context() {
    return {
      '@vocab': 'http://www.w3.org/2003/12/exif/ns#'
    }
  }

  static read(buffer, offset, isBigEndian, TAGS, { timezone } = {}, meta = {}) {
    try {
      var ifd = new IFD()
      let count = readUInt16(buffer, offset, isBigEndian)

      offset += 2

      for (let i = 0; i < count; ++i, offset += 12) {
        try {
          let tag = readUInt16(buffer, offset, isBigEndian)
          let key = TAGS[tag] || tag
          let value = IFD.readTagValue(buffer, offset + 2, isBigEndian)

          if (isDateTag(key))
            value = parseDate(value, timezone)

          ifd.tags[key] = value

        } catch (error) {
          error.offset = offset
          if (meta.errors) meta.errors.push(error)
          else throw error
        }
      }

      meta.next = readUInt32(buffer, offset, isBigEndian)

    } catch (error) {
      error.offset = offset
      if (meta.errors) meta.errors.push(error)
      else throw error
    }

    return ifd
  }

  static readTagValue(buffer, offset, isBigEndian) {
    let type = readUInt16(buffer, offset, isBigEndian)

    if (!type || type > TYPE_SIZE.length)
      return null

    let count = readUInt32(buffer, offset + 2, isBigEndian)
    let size = TYPE_SIZE[type - 1]
    let vOffset = size * count <= 4 ?
      offset + 6:
      readUInt32(buffer, offset + 6, isBigEndian)

    if (type === 2)
      return readString(buffer, vOffset, count)
    if (type === 7)
      return buffer.slice(vOffset, vOffset + count)

    let values = readValues(buffer, vOffset, size, count, isBigEndian, type)

    return (values.length === 1) ?
      values[0] :
      values
  }

  constructor(tags = {}) {
    this.tags = tags
  }

  get exif() {
    return this.tags.exif_IFD_Pointer
  }

  get gpsInfo() {
    return this.tags.gpsInfo_IFD_Pointer
  }

  get interoperability() {
    return this.tags.interoperability_IFD_Pointer
  }

  get printImageMatching() {
    return this.tags.printImageMatching_IFD_Pointer
  }

  toJSON(key) {
    let json = {}

    if (key == null)
      json['@context'] = IFD.context
    json['@type'] = 'IFD'

    return { ...json, ...this.tags }
  }
}

module.exports = IFD