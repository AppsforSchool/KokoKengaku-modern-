import { useState } from 'react'
import { useDialog } from '../../ui/DialogProvider'
import { answerIncludes, sameIndices, toIndices } from './pollAnswer'

// ★ メッセージ内に表示するアンケート（既存の buildPollWidget と同じHTML構造・同じ挙動）。
//   ・自分の回答がある選択肢に、最初からチェックが入る。自分の回答と違う選択をすると、「答える」（回答済みなら「再回答する」）が押せる。
//   ・「〇人」をタップすると、その選択肢を選んだ人の一覧。
//   ・既存は、メッセージが変更されるたびに作り直され、選択が自分の回答に戻っていた。同じにするため、呼び出し側が、変更のたびに key を変える。
//   ・【SPAで追加】複数選択（multiple）：ラジオボタンではなく、四角い選択（チェックボックス）。いくつでも選べる。1つも選んでいないときは、答えられない。

interface Props {
	messageId: string
	choices: string[]
	answerMap: Record<string, unknown>
	/** 複数選択のアンケートか。 */
	multiple: boolean
	myUserId: string
	/** 回答（選んだ番号。単一選択は、1つ）を送る。失敗したら例外を投げる。 */
	onVote: (messageId: string, selectedIndices: number[], hadMyAnswer: boolean) => Promise<void>
	onOpenVoters: (answerMap: Record<string, unknown>, choiceIndex: number, choiceLabel: string) => void
}

export function PollWidget({ messageId, choices, answerMap, multiple, myUserId, onVote, onOpenVoters }: Props) {
	const dialog = useDialog()
	const hasMyAnswer = Object.prototype.hasOwnProperty.call(answerMap, myUserId)
	const myIndices = hasMyAnswer ? toIndices(answerMap[myUserId]) : []
	const [selected, setSelected] = useState<number[]>(myIndices)
	const [sending, setSending] = useState(false)
	const groupName = `poll-${messageId}`

	const handleAnswer = async () => {
		if (selected.length === 0) return
		setSending(true)
		try {
			await onVote(messageId, selected, hasMyAnswer)
			// 成功時は、メッセージ一覧のリアルタイム再描画で、新しい状態に置き換わる
		} catch (error) {
			console.error('回答の送信に失敗しました:', error)
			await dialog.alert('回答の送信に失敗しました。\n' + (error instanceof Error ? error.message : String(error)))
			setSending(false)
		}
	}

	return (
		<div className="poll-widget">
			<div className="poll-choices-scroll">
				{choices.map((choiceLabel, index) => {
					const count = Object.values(answerMap).filter((v) => answerIncludes(v, index)).length
					return (
						<label key={index} className="poll-choice-option">
							{multiple ? (
								<input
									type="checkbox"
									name={groupName}
									value={String(index)}
									checked={selected.includes(index)}
									onChange={(e) => {
										const isChecked = e.target.checked
										setSelected((current) => {
											const next = isChecked ? [...current.filter((n) => n !== index), index] : current.filter((n) => n !== index)
											return next.sort((a, b) => a - b)
										})
									}}
								/>
							) : (
								<input
									type="radio"
									name={groupName}
									value={String(index)}
									checked={selected.includes(index)}
									onChange={() => setSelected([index])}
								/>
							)}
							<span className="poll-choice-label">{choiceLabel}</span>
							<span
								className="poll-choice-count"
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									onOpenVoters(answerMap, index, choiceLabel)
								}}
							>{`${count}人`}</span>
						</label>
					)
				})}
			</div>
			<button
				type="button"
				className="poll-answer-button"
				disabled={sending || selected.length === 0 || sameIndices(selected, myIndices)}
				onClick={() => void handleAnswer()}
			>
				{sending ? '送信中...' : hasMyAnswer ? '再回答する' : '答える'}
			</button>
		</div>
	)
}
