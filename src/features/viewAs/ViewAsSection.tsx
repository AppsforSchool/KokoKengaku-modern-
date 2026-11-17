import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useViewAs } from './ViewAsProvider'
import { ViewAsModal } from './ViewAsModal'

// ★ ドロワーの「アカウントの切り替え」欄（管理者のみ）と、アカウントの選択モーダル。
//   選んだら、ドロワーを閉じて、ルーム一覧へ移る（閲覧するアカウントの一覧が、出る）。

interface Props {
	/** 自分（管理者）のID。 */
	myUserId: string
	closeDrawer: () => void
}

export function ViewAsSection({ myUserId, closeDrawer }: Props) {
	const { viewAsUserId, viewAsName, startViewAs, stopViewAs } = useViewAs()
	const navigate = useNavigate()
	const [openToken, setOpenToken] = useState<number | null>(null)
	const count = useRef(0)

	return (
		<>
			<div className="drawer-section" id="view-as-section">
				<p className="title">アカウントの切り替え（管理者）</p>
				{viewAsUserId ? (
					<>
						<p>
							閲覧中: <strong id="view-as-current">{viewAsName || viewAsUserId}</strong>
						</p>
						<button
							id="view-as-stop-button"
							className="normal-button"
							style={{ marginBottom: '0.6rem' }}
							onClick={() => {
								stopViewAs()
								closeDrawer()
								navigate('/')
							}}
						>
							自分のアカウントに戻る
						</button>
					</>
				) : null}
				<button
					id="view-as-open-button"
					className="normal-button"
					onClick={() => {
						count.current += 1
						setOpenToken(count.current)
					}}
				>
					{viewAsUserId ? '別のアカウントを選ぶ' : '他のアカウントとして閲覧'}
				</button>
				<p className="view-as-note">既読は付かず、メッセージの送信は、管理者のアカウント名義になります。</p>
			</div>

			<ViewAsModal
				openToken={openToken}
				myUserId={myUserId}
				onClose={() => setOpenToken(null)}
				onSelect={(userId, name) => {
					startViewAs(userId, name)
					setOpenToken(null)
					closeDrawer()
					navigate('/')
				}}
			/>
		</>
	)
}
