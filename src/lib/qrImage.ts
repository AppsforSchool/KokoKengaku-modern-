// ★ 画像ファイルの中のQRコードを読み取る（ログイン画面の「画像から読み取る」。【SPAで追加した機能】）。
//   ・QRコードの読み取りは、カメラのときと同じ部品（html5-qrcode の scanFile）を使う。画像は、端末の中だけで処理し、サーバーへは送らない。
//   ・スマホで撮った写真は、画素数が大きく、QRが小さく写っていて、そのままでは読めないことがある。
//     そのため、まず元の画像、読めなければ、長辺を 1600px、900px に縮小した画像で、順に試す。
//   ・読み取りに使う html5-qrcode は、QRを使うときだけ読み込む（動的 import）。
//   ・html5-qrcode は、読み取りの表示場所（要素のid）が必要。カメラ用の要素を、そのまま使える（カメラは、先に止めておくこと）。

/** 長辺が maxSide を超えるときだけ、縮小した画像（PNG）を作る。縮小の必要がない、または作れないときは null。 */
export async function resizeImageFile(file: File, maxSide: number): Promise<File | null> {
	try {
		const bitmapUrl = URL.createObjectURL(file)
		try {
			const img = await new Promise<HTMLImageElement>((resolve, reject) => {
				const image = new Image()
				image.onload = () => resolve(image)
				image.onerror = () => reject(new Error('画像を開けませんでした'))
				image.src = bitmapUrl
			})
			const longSide = Math.max(img.naturalWidth, img.naturalHeight)
			if (!longSide || longSide <= maxSide) return null
			const scale = maxSide / longSide
			const canvas = document.createElement('canvas')
			canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
			canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
			const ctx = canvas.getContext('2d')
			if (!ctx) return null
			ctx.fillStyle = '#fff' // 透明な部分は、白にする（QRは、白地に黒）
			ctx.fillRect(0, 0, canvas.width, canvas.height)
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
			return blob ? new File([blob], 'qr-resized.png', { type: 'image/png' }) : null
		} finally {
			URL.revokeObjectURL(bitmapUrl)
		}
	} catch {
		return null
	}
}

/** 縮小して試す長辺（px）。大きい順。 */
export const QR_IMAGE_RETRY_SIZES = [1600, 900]

/**
 * 画像ファイルの中のQRコードを読み取り、その文字列を返す。見つからなければ、例外を投げる。
 * @param elementId html5-qrcode が使う要素のid（画面に存在すること）。
 */
export async function decodeQrFromImageFile(file: File, elementId: string): Promise<string> {
	const { Html5Qrcode } = await import('html5-qrcode')

	const tryDecode = async (target: File): Promise<string> => {
		const scanner = new Html5Qrcode(elementId, false)
		try {
			return await scanner.scanFile(target, false)
		} finally {
			try {
				scanner.clear()
			} catch {
				/* 何も表示していないので、失敗しても問題ない */
			}
		}
	}

	let lastError: unknown = null
	try {
		return await tryDecode(file) // まず、元の画像
	} catch (error) {
		lastError = error
	}
	for (const maxSide of QR_IMAGE_RETRY_SIZES) {
		const resized = await resizeImageFile(file, maxSide)
		if (!resized) continue // すでに、その大きさ以下
		try {
			return await tryDecode(resized)
		} catch (error) {
			lastError = error
		}
	}
	throw lastError instanceof Error ? lastError : new Error('QRコードが見つかりませんでした')
}
