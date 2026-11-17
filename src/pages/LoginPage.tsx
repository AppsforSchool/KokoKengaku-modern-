import { useCallback, useEffect, useRef, useState } from 'react'
import type { Html5Qrcode } from 'html5-qrcode'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { LoadingOverlay } from '../components/LoadingOverlay'
import { PageShell } from '../components/PageShell'
import { decodeQrFromImageFile } from '../lib/qrImage'
import { UiSwitchSection } from '../ui/UiSwitchSection'

// ★ ログイン画面。既存の index.html + script.js と同じHTML構造・同じ挙動。
//   ・ログイン済みなら、ログイン画面を出さずに、元の画面（なければルーム一覧）へ進む。
//   ・ID + パスワード、または QRコード（「ID パスワード」の形式）で入力できる。QRは、カメラでの読み取りのほか、
//     【SPAで追加】「画像から読み取る」で、画像ファイル（写真・スクリーンショット）からも読み取れる（lib/qrImage.ts）。
//   ・「アカウント情報」から、ログインしていない状態用のドロワー（新UI/旧UIのトグルだけ）を開く。

const QR_READER_ID = 'login-qr-reader'
const QR_UNSUPPORTED_MESSAGE = '非対応のQRコードです｡'
const QR_NOT_FOUND_MESSAGE = 'QRコードを読み取れませんでした。'

export default function LoginPage() {
	const { user, loading, login } = useAuth()
	const navigate = useNavigate()
	const location = useLocation()

	const [id, setId] = useState('')
	const [password, setPassword] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')

	const [qrOpen, setQrOpen] = useState(false)
	const [qrFailed, setQrFailed] = useState(false)
	const [qrFailMessage, setQrFailMessage] = useState(QR_UNSUPPORTED_MESSAGE)
	const [qrImageReading, setQrImageReading] = useState(false) // 画像の読み取り中
	const qrImageInputRef = useRef<HTMLInputElement>(null)
	const scanStartRef = useRef<Promise<void>>(Promise.resolve()) // カメラの起動処理（起動の途中で、画像を選ばれた場合に、待つため）
	const qrReadToken = useRef(0) // 画像の読み取りが、閉じられたあとに終わった場合に、無視するための番号
	const [shareOpen, setShareOpen] = useState(false)
	const [drawerOpen, setDrawerOpen] = useState(false)

	const scannerRef = useRef<Html5Qrcode | null>(null)

	// ---- ログイン済みなら、先へ進む ----
	useEffect(() => {
		if (loading || !user) return
		const from = (location.state as { from?: string } | null)?.from
		navigate(from && from.startsWith('/') ? from : '/', { replace: true })
	}, [loading, user, location.state, navigate])

	// ---- QRコードの読み取り ----
	const stopScan = useCallback(async () => {
		const scanner = scannerRef.current
		if (!scanner) return
		scannerRef.current = null
		try {
			await scanner.stop()
		} catch {
			/* すでに止まっている */
		}
	}, [])

	const inputQrData = useCallback((decoded: string) => {
		const parts = decoded.split(' ')
		if (parts.length === 2) {
			setId(parts[0])
			setPassword(parts[1])
			setQrOpen(false)
		} else {
			setQrFailMessage(QR_UNSUPPORTED_MESSAGE)
			setQrFailed(true) // 非対応のQRコード
		}
	}, [])

	const startScan = useCallback(async () => {
		try {
			const { Html5Qrcode } = await import('html5-qrcode') // QRを使うときだけ読み込む
			const scanner = new Html5Qrcode(QR_READER_ID)
			scannerRef.current = scanner
			await scanner.start(
				{ facingMode: 'environment' }, // 背面カメラ
				{ fps: 10, qrbox: { width: 250, height: 250 } },
				(decodedText) => {
					console.log('読み取り成功:', decodedText)
					void stopScan()
					inputQrData(decodedText)
				},
				() => {
					/* スキャン中に、QRが見つからない間は、ここが呼ばれ続ける（無視してよい） */
				},
			)
		} catch (err) {
			console.error('カメラ起動エラー:', err)
			alert('カメラの起動に失敗しました。ブラウザの権限を確認してください。')
			await stopScan()
			// 【SPAで変更】モーダルは閉じない（既存は、ここで閉じていた）。カメラが使えない端末（カメラのないPCなど）でも、
			//   「画像から読み取る」を使えるようにするため。
		}
	}, [inputQrData, stopScan])

	/** カメラでの読み取りを始める（起動の完了を、待てるようにしておく）。 */
	const beginScan = useCallback(() => {
		const started = startScan()
		scanStartRef.current = started
		return started
	}, [startScan])

	/** モーダルを閉じる（カメラを止め、画像の読み取り中なら、その結果は使わない）。 */
	const closeQrModal = useCallback(() => {
		qrReadToken.current += 1
		setQrImageReading(false)
		setQrOpen(false)
		void stopScan()
	}, [stopScan])

	/** 選んだ画像の中のQRコードを読み取る（【SPAで追加】）。カメラの読み取り中は、画像の読み取りができないので、先に止める。 */
	const handleQrImage = useCallback(
		async (file: File) => {
			const myRead = ++qrReadToken.current
			setQrFailed(false)
			setQrImageReading(true)
			await scanStartRef.current // カメラの起動の途中なら、起動を待ってから止める
			await stopScan()
			try {
				const decoded = await decodeQrFromImageFile(file, QR_READER_ID)
				if (myRead !== qrReadToken.current) return // 読み取り中に、閉じられた
				console.log('画像から読み取り成功')
				inputQrData(decoded)
			} catch (err) {
				if (myRead !== qrReadToken.current) return
				console.error('画像からのQR読み取りエラー:', err)
				setQrFailMessage(QR_NOT_FOUND_MESSAGE)
				setQrFailed(true)
			} finally {
				if (myRead === qrReadToken.current) setQrImageReading(false)
			}
		},
		[inputQrData, stopScan],
	)

	// ページを離れるときは、カメラを止める
	useEffect(() => () => void stopScan(), [stopScan])

	// ---- ログイン ----
	const handleLogin = async () => {
		setErrorMessage('')
		setSubmitting(true) // 多重クリックを防ぐ
		try {
			await login(id, password)
			// 成功すると、ログイン状態の変化で、上の effect が先へ進める（それまで「ログイン中...」のまま）
		} catch (error) {
			setErrorMessage('ログインに失敗しました。IDとパスワードを確認してください。')
			console.error('ログインエラー:', error)
			setSubmitting(false)
		}
	}

	const canSubmit = id.trim() !== '' && password.trim() !== ''

	return (
		<PageShell name="login">
			{/* 起動時オーバーレイ：ログイン状態が確定して、ログインしていないと分かったら閉じる */}
			<LoadingOverlay text="ログインシステムの読み込みに時間がかかる場合があります｡" hidden={!loading && !user} />

			<div
				id="qr-login-modal"
				className={'modal-overlay' + (qrOpen ? '' : ' hidden')}
			>
				<div className="modal-content">
					<div className="modal-header">
						<p className="title">QRコードで入力</p>
						<span
							id="qr-login-modal-close"
							className="close-button"
							onClick={closeQrModal}
						>
							&times;
						</span>
					</div>
					<div className="modal-scroll-body">
						<div id={QR_READER_ID} style={{ width: '100%', maxWidth: '500px', margin: 'auto' }}></div>

						{/* 【SPAで追加】画像ファイルからの読み取り */}
						<div id="qr-login-image-area">
							<input
								ref={qrImageInputRef}
								type="file"
								id="qr-login-image-input"
								accept="image/*"
								style={{ display: 'none' }}
								onChange={(e) => {
									const file = e.target.files && e.target.files[0]
									e.target.value = '' // 同じ画像を、続けて選べるようにする
									if (file) void handleQrImage(file)
								}}
							/>
							<button
								id="qr-login-image-button"
								type="button"
								disabled={qrImageReading}
								onClick={() => qrImageInputRef.current?.click()}
							>
								{qrImageReading ? '読み取り中...' : '画像から読み取る'}
							</button>
						</div>

						<div id="qr-login-failure" className={qrFailed ? undefined : 'hidden'}>
							<p>{qrFailMessage}</p>
							<button
								id="qr-login-retry"
								onClick={() => {
									setQrFailed(false)
									void beginScan()
								}}
							>
								もう一度
							</button>
						</div>
					</div>
				</div>
			</div>

			<div id="share-modal" className={'modal-overlay' + (shareOpen ? '' : ' hidden')}>
				<div className="modal-content">
					<div className="modal-header">
						<p className="title">シェア</p>
						<span id="share-modal-close" className="close-button" onClick={() => setShareOpen(false)}>
							&times;
						</span>
					</div>
					<div className="modal-scroll-body">
						<img src={`${import.meta.env.BASE_URL}qrcode.png`} alt="QR Code" />
					</div>
				</div>
			</div>

			<header id="app-header">
				<p id="header-title">高校見学</p>
				<div id="user-data">
					<button id="share-modal-btn" onClick={() => setShareOpen(true)}>
						シェア
					</button>
					<button id="setting-button" onClick={() => setDrawerOpen(true)}>
						アカウント情報
					</button>
				</div>
			</header>

			<main>
				<div id="login-container" className={user ? 'hidden' : undefined}>
					<p id="login-title">ログイン</p>
					<p className="login-subtitle" id="to-pc">
						このサイトを利用するには、ログインが必要です。
					</p>
					<p className="login-subtitle" id="to-sp">
						このサイトを利用するには、<br />
						ログインが必要です。
					</p>

					<div id="login-input">
						<input type="text" id="id" placeholder="ID" value={id} onChange={(e) => setId(e.target.value)} />
						<input
							type="password"
							id="password"
							placeholder="パスワード"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
						<a
							id="qr-login-button"
							onClick={() => {
								setQrOpen(true)
								void beginScan()
							}}
						>
							QRコードで入力
						</a>

						<button type="submit" id="login-button" disabled={submitting || !canSubmit} onClick={() => void handleLogin()}>
							{submitting ? 'ログイン中...' : 'ログイン'}
						</button>
						<p id="error-message">{errorMessage}</p>
					</div>
				</div>
			</main>

			<footer>
				<p>QRコードは株式会社デンソーウェーブの登録商標です。</p>
			</footer>

			{/* ログインしていない状態用のドロワー（既存の uiSwitch.js の buildLoggedOutDrawer と同じ構造） */}
			<div id="drawerOverlay" className={'drawer-overlay' + (drawerOpen ? ' is-open' : '')} onClick={() => setDrawerOpen(false)}></div>
			<div id="accountSettingsDrawer" className={'drawer' + (drawerOpen ? ' is-open' : '')}>
				<div className="drawer-header">
					<p>アカウント設定</p>
					<span id="drawerCloseButton" className="drawer-close-button" onClick={() => setDrawerOpen(false)}>
						&times;
					</span>
				</div>
				<div className="drawer-content">
					<div className="drawer-section">
						<p className="title">現在のユーザー</p>
						<p>ログインしていません</p>
					</div>
					<UiSwitchSection />
				</div>
			</div>
		</PageShell>
	)
}
