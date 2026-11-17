import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../../auth/AuthProvider'

// ★ 管理者が、他のアカウントとして閲覧する（【SPAで追加した機能】ユーザー指示）。
//   ・「閲覧中のアカウント」を、ブラウザのタブごと（sessionStorage）に覚える。タブを閉じる・ログアウトすると、元に戻る。
//   ・覚えるのは、「誰が（管理者のID）、誰として（閲覧中のID・名前）」。ログイン中のIDが、覚えている管理者のIDと違えば、無効にする。
//   ・閲覧中は、画面の「見え方（誰の一覧か、どちらが自分のメッセージか、どこから未読か）」だけを、そのアカウントにする。
//     書き込み（送信・投票・編集など）は、本当のアカウント（管理者）名義のまま。既読・最終確認日時・未読数は、書き込まない。

const STORAGE_KEY = 'kokoKengakuViewAs'

interface Stored {
	adminId: string
	userId: string
	name: string
}

function readStored(): Stored | null {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<Stored>
		if (parsed && typeof parsed.adminId === 'string' && typeof parsed.userId === 'string') {
			return { adminId: parsed.adminId, userId: parsed.userId, name: typeof parsed.name === 'string' ? parsed.name : '' }
		}
	} catch {
		/* 読めなければ、閲覧なし */
	}
	return null
}

function writeStored(value: Stored | null): void {
	try {
		if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
		else sessionStorage.removeItem(STORAGE_KEY)
	} catch {
		/* 保存できなくても、この画面の中では有効 */
	}
}

interface ViewAsValue {
	/** 閲覧中のアカウントのID。閲覧していなければ null。 */
	viewAsUserId: string | null
	viewAsName: string
	/** 他のアカウントとしての閲覧を始める（呼び出す前に、管理者であることを確認しておく）。 */
	startViewAs: (userId: string, name: string) => void
	/** 自分のアカウントに戻る。 */
	stopViewAs: () => void
}

const ViewAsContext = createContext<ViewAsValue | null>(null)

export function ViewAsProvider({ children }: { children: ReactNode }) {
	const { userId: authUserId, loading } = useAuth()
	const [stored, setStored] = useState<Stored | null>(readStored)

	// ログアウトした、または、別のIDでログインし直したときは、閲覧を解除する（ログイン状態が確定するまでは、何もしない）
	useEffect(() => {
		if (loading || !stored) return
		if (!authUserId || stored.adminId !== authUserId) {
			writeStored(null)
			setStored(null)
		}
	}, [loading, authUserId, stored])

	const startViewAs = useCallback(
		(userId: string, name: string) => {
			if (!authUserId || userId === authUserId) return // 自分自身は、閲覧にしない
			const next: Stored = { adminId: authUserId, userId, name }
			writeStored(next)
			setStored(next)
		},
		[authUserId],
	)

	const stopViewAs = useCallback(() => {
		writeStored(null)
		setStored(null)
	}, [])

	const valid = stored && authUserId && stored.adminId === authUserId ? stored : null
	const value = useMemo<ViewAsValue>(
		() => ({
			viewAsUserId: valid ? valid.userId : null,
			viewAsName: valid ? valid.name : '',
			startViewAs,
			stopViewAs,
		}),
		[valid, startViewAs, stopViewAs],
	)

	return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>
}

export function useViewAs(): ViewAsValue {
	const value = useContext(ViewAsContext)
	if (!value) throw new Error('useViewAs は ViewAsProvider の中で使ってください')
	return value
}
