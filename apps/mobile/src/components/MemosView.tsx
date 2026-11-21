import { useMemo, useState } from 'react'
import { Alert, Modal, StyleSheet, TextInput, View, Pressable, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { NotebookPen, Pin, PinOff, Plus, Search, Trash2, X } from 'lucide-react-native'
import { MEMO_CONTENT_LIMIT, type Memo } from '@focusnotes/core'
import { formatDateTime } from '../date'

interface Props {
  memos: Memo[]
  onSave(memo: Memo): void
  onDelete(id: string): void
}

function blankMemo(): Memo {
  const now = new Date().toISOString()
  return { id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, title: '', content: '', pinned: false, createdAt: now, updatedAt: now, revision: 1, deleted: false }
}

export function MemosView({ memos, onSave, onDelete }: Props) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Memo | null>(null)

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const alive = memos.filter((item) => !item.deleted)
    const filtered = keyword
      ? alive.filter((item) => `${item.title}\n${item.content}`.toLowerCase().includes(keyword))
      : alive
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    })
  }, [memos, query])

  return <View style={styles.wrap}>
    <View style={styles.searchRow}>
      <Search size={15} color="#8e8d93" />
      <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="搜索备忘录" placeholderTextColor="#8e8d93" />
      {query !== '' && <Pressable onPress={() => setQuery('')} accessibilityLabel="清除搜索"><X size={15} color="#8e8d93" /></Pressable>}
    </View>

    {visible.length === 0
      ? <View style={styles.empty}><NotebookPen size={28} color="#8e8d93" /><Text style={styles.emptyTitle}>{query ? '没有匹配的备忘录' : '还没有备忘录'}</Text><Text style={styles.emptyText}>记录一段长文字，随时回看。</Text></View>
      : <View style={styles.list}>
        {visible.map((item) => <Pressable key={item.id} style={styles.card} onPress={() => setEditing(item)}>
          <View style={styles.cardHead}>
            {item.pinned && <Pin size={12} color="#0071e3" />}
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title || '无标题'}</Text>
          </View>
          <Text style={styles.cardBody} numberOfLines={3}>{item.content || '（空）'}</Text>
          <Text style={styles.cardTime}>{formatDateTime(item.updatedAt)} · {item.content.length} 字</Text>
        </Pressable>)}
      </View>}

    <Pressable style={styles.fab} onPress={() => setEditing(blankMemo())} accessibilityLabel="新建备忘录"><Plus size={26} color="#fff" /></Pressable>

    {editing && <Modal animationType="slide" onRequestClose={() => setEditing(null)}>
      <KeyboardAvoidingView style={styles.modalSafe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalHeader}>
          <Pressable style={styles.modalIcon} onPress={() => setEditing(null)} accessibilityLabel="关闭"><X size={22} color="#1d1d1f" /></Pressable>
          <Text style={styles.modalTitle}>{memos.some((item) => item.id === editing.id) ? '编辑备忘录' : '新建备忘录'}</Text>
          <Pressable style={styles.modalIcon} onPress={() => {
            const next = { ...editing, updatedAt: new Date().toISOString(), revision: editing.revision + (memos.some((item) => item.id === editing.id) ? 1 : 0) }
            if (!next.title.trim() && !next.content.trim()) { setEditing(null); return }
            onSave(next); setEditing(null)
          }} accessibilityLabel="保存"><Text style={styles.saveText}>保存</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <TextInput style={styles.titleInput} value={editing.title} onChangeText={(title) => setEditing({ ...editing, title })}
            placeholder="标题" placeholderTextColor="#8e8d93" maxLength={200} />
          <TextInput style={styles.contentInput} value={editing.content} onChangeText={(content) => setEditing({ ...editing, content: content.slice(0, MEMO_CONTENT_LIMIT) })}
            placeholder="正文…（支持长文本）" placeholderTextColor="#8e8d93" multiline textAlignVertical="top" />
          <Text style={styles.counter}>{editing.content.length} / {MEMO_CONTENT_LIMIT}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.actionButton} onPress={() => setEditing({ ...editing, pinned: !editing.pinned })}>
              {editing.pinned ? <PinOff size={15} color="#0071e3" /> : <Pin size={15} color="#6e6e73" />}
              <Text style={[styles.actionText, editing.pinned && styles.actionTextActive]}>{editing.pinned ? '取消置顶' : '置顶'}</Text>
            </Pressable>
            {memos.some((item) => item.id === editing.id) && <Pressable style={styles.actionButton} onPress={() => {
              const id = editing.id
              Alert.alert('删除备忘录', '删除后不可恢复。', [
                { text: '取消', style: 'cancel' },
                { text: '删除', style: 'destructive', onPress: () => { onDelete(id); setEditing(null) } },
              ])
            }}><Trash2 size={15} color="#d70015" /><Text style={[styles.actionText, styles.danger]}>删除</Text></Pressable>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>}
  </View>
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginBottom: 12, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#f5f5f7' },
  searchInput: { flex: 1, color: '#1d1d1f', fontSize: 14 },
  list: { gap: 9, paddingBottom: 96 },
  card: { padding: 14, borderRadius: 13, backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e5ea' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, color: '#1d1d1f', fontSize: 15, fontWeight: '600' },
  cardBody: { marginTop: 6, color: '#6e6e73', fontSize: 12.5, lineHeight: 19 },
  cardTime: { marginTop: 8, color: '#a1a1aa', fontSize: 10 },
  empty: { minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 12, color: '#48484a', fontSize: 15, fontWeight: '600' },
  emptyText: { marginTop: 7, color: '#8e8d93', fontSize: 12 },
  fab: { position: 'absolute', right: 6, bottom: 18, width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: '#0071e3', shadowColor: '#0071e3', shadowOpacity: .3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  modalSafe: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d1d1d6' },
  modalIcon: { minWidth: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: '#1d1d1f', fontSize: 17, fontWeight: '600' },
  saveText: { color: '#0071e3', fontSize: 15, fontWeight: '600' },
  modalBody: { padding: 20 },
  titleInput: { minHeight: 46, color: '#1d1d1f', fontSize: 20, fontWeight: '600', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea', paddingBottom: 10 },
  contentInput: { minHeight: 320, marginTop: 14, color: '#1d1d1f', fontSize: 15, lineHeight: 24 },
  counter: { marginTop: 6, color: '#a1a1aa', fontSize: 11, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e5ea' },
  actionButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#f5f5f7' },
  actionText: { color: '#6e6e73', fontSize: 13 },
  actionTextActive: { color: '#0071e3', fontWeight: '600' },
  danger: { color: '#d70015' },
})
