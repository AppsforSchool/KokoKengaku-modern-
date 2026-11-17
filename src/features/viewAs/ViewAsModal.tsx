import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { collection, db, getDocs } from '../../firebase'
import { useDialog } from '../../ui/DialogProvider'

// ★ 閲覧するアカウントを選ぶモーダル（管理者のみ）。開くたびに、全ユーザーを取得して、番号（no）の順に並べる。名前・IDで絞り込める。

interface UserItem {
	userId: string
	name: string
	imageUrl: string
	isActive: boolean
	no: number
}

interface Props {
	/** 開くたびに変える（開いている間は、非 null）。 */
	openToken: number | null
	/** 自分（管理者）のID。一覧から除く。 */
	myUserId: string
	onClose: () => void
	onSelect: (userId: string, name: string) => void
}

export function ViewAsModal({ openToken, myUserId, onClose, onSelect }: Props) {
	const dialog = useDialog()
	const [users, setUsers] = useState<UserItem[]>([])
	const [loading, setLoading] = useState(false)
	const [query, setQuery] = useState('')
	const runId = useRef(0)

	useEffect(() => {
		if (openToken === null) return
		const myRun = ++runId.current
		setQuery('')
		setUsers([])
		setLoading(true)
		void (async () => {
			try {
				const snapshot = await getDocs(collection(db, 'users_random'))
				if (myRun !== runId.current) return
				const list: UserItem[] = snapshot.docs
					.filter((d) => d.id !== myUserId)
					.map((d) => {
						const data = d.data() || {}
						return {
							userId: d.id,
							name: (data.name as string) || d.id,
							imageUrl: (data.imageUrl as string) || '',
							isActive: data.isActive !== false,
							no: typeof data.no === 'number' ? (data.no as number) : Infinity,
						}
					})
					.sort((a, b) => (a.no === b.no ? 0 : a.no < b.no ? -1 : 1))
				setUsers(list)
				setLoading(false)
			} catch (error) {
				if (myRun !== runId.current) return
				setLoading(false)
				console.error('ユーザー一覧の取得エラー:', error)
				await dialog.alert('ユーザー一覧の取得に失敗しました。\n' + (error instanceof Error ? error.message : String(error)))
			}
		})()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [openToken])

	const lower = query.trim().toLowerCase()
	const filtered = users.filter((u) => !lower || u.name.toLowerCase().includes(lower) || u.userId.toLowerCase().includes(lower))

	return (
		<div id="view-as-modal" className={'modal-overlay' + (openToken !== null ? '' : ' hidden')}>
			<div className="modal-content">
				<div className="modal-header">
					<p className="title">閲覧するアカウントを選ぶ</p>
					<span id="view-as-modal-close" className="close-button" onClick={onClose}>
						&times;
					</span>
				</div>
				<div className="modal-scroll-body">
					<p className="view-as-note">選んだアカウントの、トーク一覧とトークを閲覧します。既読は付かず、メッセージの送信は、管理者のアカウント名義になります。</p>
					<input id="view-as-search" type="text" placeholder="名前・IDで検索" value={query} onChange={(e) => setQuery(e.target.value)} />
					<p id="view-as-loading" className={loading ? undefined : 'hidden'}>
						読み込み中...
					</p>
					<div id="view-as-list">
						{!loading && filtered.length === 0 && <p>{users.length === 0 ? '選べるユーザーがいません。' : '該当するユーザーがいません。'}</p>}
						{!loading &&
							filtered.map((u) => (
								<div key={u.userId} className="view-as-item" onClick={() => onSelect(u.userId, u.name)}>
									<Avatar name={u.name} size="small" imageUrl={u.imageUrl} />
									<span className="view-as-item-name">{u.name}</span>
									<span className="view-as-item-id">{u.userId + (u.isActive ? '' : '（停止中）')}</span>
								</div>
							))}
					</div>
				</div>
			</div>
		</div>
	)
}
