import { useNavigate } from 'react-router-dom'
import { useViewAs } from './ViewAsProvider'

// ★ 閲覧中であることを示す帯（ヘッダーの中。閲覧していないときは、何も出さない）。
//   ヘッダーの中に置くので、ヘッダーの高さ（--header-height）に、自動で含まれる。

interface Props {
	/** 送信の名義になる、自分（管理者）の名前。 */
	actorName: string
	/** 実際に、他のアカウントとして閲覧しているとき true（画面の基準が、自分と違うとき）。 */
	active: boolean
}

export function ViewAsBanner({ actorName, active }: Props) {
	const { viewAsUserId, viewAsName, stopViewAs } = useViewAs()
	const navigate = useNavigate()
	if (!active || !viewAsUserId) return null
	return (
		<div id="view-as-banner">
			<span id="view-as-banner-text">
				{`「${viewAsName || viewAsUserId}」として閲覧中（既読は付きません／送信は${actorName ? '「' + actorName + '」' : '管理者'}名義）`}
			</span>
			<button
				id="view-as-banner-stop"
				type="button"
				onClick={() => {
					stopViewAs()
					navigate('/')
				}}
			>
				戻る
			</button>
		</div>
	)
}
