import { useLayoutEffect, useRef, useState } from 'react'
import { useDialog } from '../../ui/DialogProvider'

// ★ アンケート作成モーダル（既存の talkScript.js のアンケート作成と同じHTML構造・同じ挙動）。
//   ・開くたびに、質問欄を空に、選択肢を2行に戻す。選択肢は、最小2・最大10。最小のあいだは、削除ボタン「×」を隠す。
//   ・質問が入力され、選択肢が2つ以上埋まっていれば、送信できる。
//   ・空の選択肢は、送るときに取り除く（最大10個まで）。
//   ・【SPAで追加】回答方法を選べる：単一選択（既存と同じ。既定）／複数選択。開くたびに、単一選択に戻す。

export const POLL_MIN_CHOICES = 2
export const POLL_MAX_CHOICES = 10

interface Props {
	open: boolean
	onClose: () => void
	/** アンケートを送る。失敗したら例外を投げる（成功したら、返信状態の解除もここで行う）。 */
	onSubmit: (question: string, choices: string[], multiple: boolean) => Promise<void>
}

interface Row {
	id: number
	value: string
}

export function PollCreateModal({ open, onClose, onSubmit }: Props) {
	const dialog = useDialog()
	const nextId = useRef(1)
	const makeRows = (): Row[] => Array.from({ length: POLL_MIN_CHOICES }, () => ({ id: nextId.current++, value: '' }))
	const [question, setQuestion] = useState('')
	const [rows, setRows] = useState<Row[]>(() => makeRows())
	const [multiple, setMultiple] = useState(false) // 複数選択か（既定は、単一選択）
	const [submitting, setSubmitting] = useState(false)

	const reset = () => {
		setQuestion('')
		setMultiple(false)
		setRows(makeRows())
	}

	// 開くたびに、フォームを初期状態（質問欄クリア・選択肢2行）にする（描画の前に行い、一瞬、空の状態が見えないようにする）
	useLayoutEffect(() => {
		if (open) reset()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	const filledChoices = rows.filter((row) => row.value.trim() !== '').length
	const canSubmit = question.trim() !== '' && filledChoices >= POLL_MIN_CHOICES
	const canRemove = rows.length > POLL_MIN_CHOICES

	const handleSubmit = async () => {
		const trimmedQuestion = question.trim()
		const choices = rows
			.map((row) => row.value.trim())
			.filter((value) => value !== '')
			.slice(0, POLL_MAX_CHOICES)
		if (!trimmedQuestion || choices.length < POLL_MIN_CHOICES) return

		setSubmitting(true)
		try {
			await onSubmit(trimmedQuestion, choices, multiple)
			onClose()
			reset()
		} catch (error) {
			console.error('アンケート送信中にエラーが発生しました:', error)
			await dialog.alert('アンケートの送信に失敗しました。\n' + (error instanceof Error ? error.message : String(error)))
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<div id="poll-create-modal" className={'modal-overlay' + (open ? '' : ' hidden')}>
			<div className="modal-content">
				<div className="modal-header">
					<p className="title">アンケートを作成</p>
					<span id="poll-create-modal-close" className="close-button" onClick={onClose}>
						&times;
					</span>
				</div>
				<div className="modal-scroll-body">
					<textarea
						id="poll-question-input"
						rows={3}
						placeholder="質問・説明文を入力"
						value={question}
						onChange={(e) => setQuestion(e.target.value)}
					></textarea>

					<p className="profile-label" style={{ marginTop: '1rem' }}>
						回答方法
					</p>
					<div id="poll-mode-group">
						<label className="poll-choice-option">
							<input type="radio" name="poll-mode" id="poll-mode-single" checked={!multiple} onChange={() => setMultiple(false)} />
							<span className="poll-choice-label">単一選択</span>
						</label>
						<label className="poll-choice-option">
							<input type="radio" name="poll-mode" id="poll-mode-multiple" checked={multiple} onChange={() => setMultiple(true)} />
							<span className="poll-choice-label">複数選択</span>
						</label>
					</div>

					<p className="profile-label" style={{ marginTop: '1rem' }}>
						選択肢
					</p>
					<div id="poll-choices-list">
						{rows.map((row, index) => (
							<div key={row.id} className="poll-choice-row">
								<input
									type="text"
									className="poll-choice-input"
									maxLength={100}
									placeholder={`選択肢 ${index + 1}`}
									value={row.value}
									onChange={(e) => {
										const value = e.target.value
										setRows((current) => current.map((r) => (r.id === row.id ? { ...r, value } : r)))
									}}
								/>
								<button
									type="button"
									className={'poll-choice-remove' + (canRemove ? '' : ' hidden')}
									aria-label="選択肢を削除"
									onClick={() => {
										if (rows.length <= POLL_MIN_CHOICES) return
										setRows((current) => current.filter((r) => r.id !== row.id))
									}}
								>
									×
								</button>
							</div>
						))}
					</div>
					<button
						id="poll-add-choice-button"
						className="secondary-button"
						type="button"
						disabled={rows.length >= POLL_MAX_CHOICES}
						onClick={() => {
							if (rows.length >= POLL_MAX_CHOICES) return
							setRows((current) => [...current, { id: nextId.current++, value: '' }])
						}}
					>
						＋ 選択肢を追加
					</button>

					<button id="poll-submit-button" className="normal-button" disabled={submitting || !canSubmit} onClick={() => void handleSubmit()}>
						{submitting ? '送信中...' : 'アンケートを送信'}
					</button>
				</div>
			</div>
		</div>
	)
}
