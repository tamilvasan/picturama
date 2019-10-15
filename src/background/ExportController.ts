import piexif from 'piexifjs'

import { getMasterPath } from 'common/util/DataUtil'
import { parsePath } from 'common/util/TextUtil'
import { Photo, PhotoExportOptions } from 'common/CommonTypes'

import { fetchPhotoWorkOfPhoto } from 'background/store/PhotoWorkStore'
import { fsExists, fsWriteFile, fsReadFile, fsStat, fsUtimes } from 'background/util/FileUtil'
import { parseImageDataUrl } from 'background/util/NodeUtil'
import ForegroundClient from 'background/ForegroundClient'


export async function exportPhoto(photo: Photo, folderPath: string, options: PhotoExportOptions): Promise<void> {
    const masterPath = getMasterPath(photo)
    const photoWork = await fetchPhotoWorkOfPhoto(photo)
    let imageDataUrl = await ForegroundClient.renderPhoto(photo, photoWork, null, options)

    let exportFilePath: string
    let counter = 0
    const filenameParts = parsePath(photo.master_filename)
    do {
        const suffix = counter === 0 ? '' : ('_' + (counter < 10 ? '00' : counter < 100 ? '0' : '') + counter)
        exportFilePath = `${folderPath}/${filenameParts.name}${suffix}.${options.format}`
        counter++
    } while (await fsExists(exportFilePath))

    if (options.withMetadata) {
        const masterImageBuffer = await fsReadFile(masterPath)
        const masterImageData = masterImageBuffer.toString('binary')
        const metaData = piexif.load(masterImageData)
        imageDataUrl = piexif.insert(piexif.dump(metaData), imageDataUrl)
    }

    await fsWriteFile(exportFilePath, parseImageDataUrl(imageDataUrl))

    const masterStat = await fsStat(masterPath)
    await fsUtimes(exportFilePath, masterStat.atime, masterStat.mtime)

    console.log('Exported ' + exportFilePath)
}
