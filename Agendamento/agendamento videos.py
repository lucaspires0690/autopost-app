import csv
import re
import os
from datetime import datetime, timedelta
from tkinter import Tk, filedialog, messagebox, Toplevel, Label, Entry, Button, StringVar, CENTER
from docx import Document

def ler_metadados_docx(caminho_arquivo):
    """Lê o arquivo (docx ou txt) e extrai títulos, descrições e tags - SOLUÇÃO DEFINITIVA"""
    if caminho_arquivo.lower().endswith('.txt'):
        with open(caminho_arquivo, 'r', encoding='utf-8') as f:
            texto_completo = f.read()
    else:
        try:
            doc = Document(caminho_arquivo)
            texto_completo = '\n'.join([paragrafo.text for paragrafo in doc.paragraphs])
        except:
            with open(caminho_arquivo, 'r', encoding='utf-8') as f:
                texto_completo = f.read()
    
    print("=== ANÁLISE COMPLETA DO ARQUIVO ===")
    
    # FUNÇÃO PARA REMOVER HASHTAGS DAS DESCRIÇÕES
    def remover_hashtags_descricoes(texto):
        """Remove todas as hashtags e linhas de hashtags das descrições"""
        # Remover linhas que contenham apenas hashtags
        linhas = texto.split('\n')
        linhas_limpas = []
        
        for linha in linhas:
            linha_limpa = linha.strip()
            # Se a linha contém "Hashtags:", "**Hashtags:**", ou apenas hashtags, ignorar
            if re.match(r'^\s*(\*\*)?Hashtags?(\*\*)?\s*:?\s*$', linha_limpa, re.IGNORECASE):
                print("⚠️ Removendo linha de hashtags:", linha_limpa[:50])
                continue
            # Se a linha contém apenas hashtags (#tag1 #tag2), ignorar
            if re.match(r'^\s*(#\w+\s*)+$', linha_limpa):
                print("⚠️ Removendo linha com apenas hashtags:", linha_limpa[:50])
                continue
            # Remover hashtags individuais dentro do texto, mas manter o texto
            linha_sem_hashtags = re.sub(r'#\w+', '', linha)
            if linha_sem_hashtags.strip():
                linhas_limpas.append(linha_sem_hashtags)
        
        return '\n'.join(linhas_limpas)
    
    # EXTRAIR SEÇÕES
    titulos = []
    descricoes = []
    tags = []
    
    # 1. EXTRAIR TÍTULOS
    print("\n--- EXTRAINDO TÍTULOS ---")
    match_titulos = re.search(r'TÍTULOS?:(.*?)(?=DESCRI[ÇC][ÕO]ES?:|$)', texto_completo, re.DOTALL | re.IGNORECASE)
    if match_titulos:
        conteudo_titulos = match_titulos.group(1).strip()
        linhas = conteudo_titulos.split('\n')
        for linha in linhas:
            linha_limpa = linha.strip()
            if linha_limpa:
                titulo = re.sub(r'^\d+\.\s*', '', linha_limpa)
                if titulo:
                    titulos.append(titulo)
    
    print(f"Total de títulos encontrados: {len(titulos)}")
    
    # 2. EXTRAIR DESCRIÇÕES - REMOVENDO HASHTAGS PRIMEIRO
    print("\n--- EXTRAINDO DESCRIÇÕES ---")
    
    # Encontrar a seção de descrições
    match_descricoes = re.search(
        r'DESCRI[ÇC][ÕO]ES?:(.*?)(?=TAGS?:|$)',
        texto_completo, 
        re.DOTALL | re.IGNORECASE
    )
    
    if match_descricoes:
        conteudo_descricoes = match_descricoes.group(1).strip()
        print(f"Tamanho original das descrições: {len(conteudo_descricoes)} caracteres")
        
        # REMOVER HASHTAGS DAS DESCRIÇÕES
        conteudo_descricoes_limpo = remover_hashtags_descricoes(conteudo_descricoes)
        print(f"Tamanho após remover hashtags: {len(conteudo_descricoes_limpo)} caracteres")
        
        # Processar descrições limpas
        descricao_atual = ""
        numero_atual = 0
        
        linhas = conteudo_descricoes_limpo.split('\n')
        print(f"Total de linhas nas descrições (após limpeza): {len(linhas)}")
        
        for i, linha in enumerate(linhas):
            linha_limpa = linha.strip()
            if not linha_limpa:
                if descricao_atual and numero_atual > 0:
                    descricoes.append(descricao_atual.strip())
                    descricao_atual = ""
                continue
            
            # Verificar se é nova descrição numerada
            match = re.match(r'^(\d+)\.\s*(.*)$', linha_limpa)
            if match:
                if descricao_atual and numero_atual > 0:
                    descricoes.append(descricao_atual.strip())
                
                numero_atual = int(match.group(1))
                descricao_atual = match.group(2)
                print(f"▶ Descrição {numero_atual} encontrada")
            else:
                if descricao_atual:
                    descricao_atual += " " + linha_limpa
                elif numero_atual == 0:
                    # Primeira descrição sem numeração explícita
                    numero_atual = 1
                    descricao_atual = linha_limpa
                    print(f"▶ Descrição 1 (inferida) iniciada")
        
        if descricao_atual and numero_atual > 0:
            descricoes.append(descricao_atual.strip())
    
    print(f"Total de descrições encontradas: {len(descricoes)}")
    
    # 3. EXTRAIR TAGS
    print("\n--- EXTRAINDO TAGS ---")
    match_tags = re.search(r'TAGS?:(.*?)$', texto_completo, re.DOTALL | re.IGNORECASE)
    if match_tags:
        conteudo_tags = match_tags.group(1).strip()
        
        # Processar tags normalmente
        tags = []
        tag_atual = ""
        numero_atual = 0
        
        linhas = conteudo_tags.split('\n')
        for linha in linhas:
            linha_limpa = linha.strip()
            if not linha_limpa:
                if tag_atual and numero_atual > 0:
                    tags.append(tag_atual.strip())
                    tag_atual = ""
                continue
            
            match = re.match(r'^(\d+)\.\s*(.*)$', linha_limpa)
            if match:
                if tag_atual and numero_atual > 0:
                    tags.append(tag_atual.strip())
                
                numero_atual = int(match.group(1))
                tag_atual = match.group(2)
            else:
                if tag_atual:
                    tag_atual += " " + linha_limpa
        
        if tag_atual and numero_atual > 0:
            tags.append(tag_atual.strip())
        
        print(f"Total de tags encontradas: {len(tags)}")
    
    print(f"\n=== RESULTADO FINAL ===")
    print(f"Títulos: {len(titulos)}")
    print(f"Descrições: {len(descricoes)}")
    print(f"Tags: {len(tags)}")
    
    # CORREÇÃO AUTOMÁTICA SE NECESSÁRIO
    if len(descricoes) < len(titulos):
        print(f"⚠️ Completando {len(titulos) - len(descricoes)} descrições faltantes")
        descricao_padrao = descricoes[0] if descricoes else "Descrição não disponível"
        descricoes.extend([descricao_padrao] * (len(titulos) - len(descricoes)))
    
    if len(tags) < len(titulos):
        print(f"⚠️ Completando {len(titulos) - len(tags)} tags faltantes")
        tag_padrao = tags[0] if tags else ""
        tags.extend([tag_padrao] * (len(titulos) - len(tags)))
    
    return titulos, descricoes, tags

# [AS OUTRAS FUNÇÕES PERMANECEM EXATAMENTE IGUAIS...]

def validar_data(data_str):
    """Valida formato de data DD/MM/AAAA"""
    try:
        datetime.strptime(data_str, '%d/%m/%Y')
        return True
    except ValueError:
        return False

def validar_hora(hora_str):
    """Valida formato de hora HH:MM"""
    try:
        datetime.strptime(hora_str, '%H:%M')
        return True
    except ValueError:
        return False

def solicitar_data():
    """Janela para solicitar data"""
    janela = Tk()
    janela.title("Data Inicial")
    janela.geometry("400x200")
    janela.eval('tk::PlaceWindow . center')
    
    resultado = {'valor': None}
    numeros = {'text': ''}
    
    Label(janela, text="Digite a data de início (DDMMAAAA):", 
          font=("Arial", 12)).pack(pady=20)
    
    var = StringVar()
    entry = Entry(janela, textvariable=var, font=("Arial", 16), 
                  width=15, justify=CENTER, state='readonly', 
                  readonlybackground='white', cursor='arrow')
    entry.pack(pady=10)
    entry.focus()
    
    def tecla_pressionada(event):
        if event.char.isdigit() and len(numeros['text']) < 8:
            numeros['text'] += event.char
            apenas_numeros = numeros['text']
            
            formatado = apenas_numeros
            if len(apenas_numeros) > 2:
                formatado = apenas_numeros[:2] + '/' + apenas_numeros[2:]
            if len(apenas_numeros) > 4:
                formatado = apenas_numeros[:2] + '/' + apenas_numeros[2:4] + '/' + apenas_numeros[4:]
            
            var.set(formatado)
        elif event.keysym == 'BackSpace' and len(numeros['text']) > 0:
            numeros['text'] = numeros['text'][:-1]
            apenas_numeros = numeros['text']
            
            formatado = apenas_numeros
            if len(apenas_numeros) > 2:
                formatado = apenas_numeros[:2] + '/' + apenas_numeros[2:]
            if len(apenas_numeros) > 4:
                formatado = apenas_numeros[:2] + '/' + apenas_numeros[2:4] + '/' + apenas_numeros[4:]
            
            var.set(formatado)
    
    def confirmar():
        valor = var.get()
        if validar_data(valor):
            resultado['valor'] = valor
            janela.quit()
            janela.destroy()
        else:
            messagebox.showerror("Erro", "Data inválida! Use DD/MM/AAAA", parent=janela)
    
    janela.bind('<Key>', tecla_pressionada)
    entry.bind('<Return>', lambda e: confirmar())
    
    Button(janela, text="OK", command=confirmar, 
           width=15, font=("Arial", 11), bg="#4CAF50", fg="white").pack(pady=15)
    
    janela.mainloop()
    return resultado['valor']

def solicitar_hora():
    """Janela para solicitar hora"""
    janela = Tk()
    janela.title("Horário de Postagem")
    janela.geometry("400x200")
    janela.eval('tk::PlaceWindow . center')
    
    resultado = {'valor': None}
    numeros = {'text': ''}
    
    Label(janela, text="Digite o horário (HHMM):", 
          font=("Arial", 12)).pack(pady=20)
    
    var = StringVar()
    entry = Entry(janela, textvariable=var, font=("Arial", 16), 
                  width=10, justify=CENTER, state='readonly',
                  readonlybackground='white', cursor='arrow')
    entry.pack(pady=10)
    entry.focus()
    
    def tecla_pressionada(event):
        if event.char.isdigit() and len(numeros['text']) < 4:
            numeros['text'] += event.char
            apenas_numeros = numeros['text']
            
            formatado = apenas_numeros
            if len(apenas_numeros) > 2:
                formatado = apenas_numeros[:2] + ':' + apenas_numeros[2:]
            
            var.set(formatado)
        elif event.keysym == 'BackSpace' and len(numeros['text']) > 0:
            numeros['text'] = numeros['text'][:-1]
            apenas_numeros = numeros['text']
            
            formatado = apenas_numeros
            if len(apenas_numeros) > 2:
                formatado = apenas_numeros[:2] + ':' + apenas_numeros[2:]
            
            var.set(formatado)
    
    def confirmar():
        valor = var.get()
        if validar_hora(valor):
            resultado['valor'] = valor
            janela.quit()
            janela.destroy()
        else:
            messagebox.showerror("Erro", "Horário inválido! Use HH:MM", parent=janela)
    
    janela.bind('<Key>', tecla_pressionada)
    entry.bind('<Return>', lambda e: confirmar())
    
    Button(janela, text="OK", command=confirmar, 
           width=15, font=("Arial", 11), bg="#4CAF50", fg="white").pack(pady=15)
    
    janela.mainloop()
    return resultado['valor']

def gerar_planilha():
    """Função principal"""
    root = Tk()
    root.withdraw()
    
    # 1. Solicitar arquivo com metadados
    messagebox.showinfo("Passo 1", "Selecione o arquivo com os metadados")
    caminho_docx = filedialog.askopenfilename(
        title="Selecione o arquivo com metadados",
        filetypes=[
            ("Todos os arquivos de texto", "*.docx *.txt *.doc"),
            ("Word Documents", "*.docx"),
            ("Text Files", "*.txt"),
            ("Todos os arquivos", "*.*")
        ]
    )
    
    if not caminho_docx:
        messagebox.showerror("Erro", "Nenhum arquivo selecionado!")
        root.destroy()
        return
    
    # Ler metadados
    try:
        titulos, descricoes, tags = ler_metadados_docx(caminho_docx)
    except Exception as e:
        messagebox.showerror("Erro", f"Erro ao ler arquivo: {str(e)}")
        root.destroy()
        return
    
    # VERIFICAÇÃO FINAL
    num_videos = len(titulos)
    
    if num_videos == 0:
        messagebox.showerror("Erro", "Nenhum vídeo encontrado no arquivo!")
        root.destroy()
        return
    
    if len(descricoes) != num_videos or len(tags) != num_videos:
        messagebox.showerror("Erro", 
            f"Quantidade inconsistente após processamento!\n"
            f"Títulos: {num_videos}\n"
            f"Descrições: {len(descricoes)}\n"
            f"Tags: {len(tags)}\n\n"
            f"Verifique o console para detalhes.")
        root.destroy()
        return
    
    root.destroy()
    
    # 2. Solicitar data inicial
    data_str = solicitar_data()
    if not data_str:
        return
    
    data_inicio = datetime.strptime(data_str, '%d/%m/%Y')
    
    # 3. Solicitar horário
    horario = solicitar_hora()
    if not horario:
        return
    
    # 4. Gerar CSV na mesma pasta do script
    pasta_script = os.path.dirname(os.path.abspath(__file__))
    caminho_csv = os.path.join(pasta_script, "planilha_agendamento.csv")
    
    # Escrever CSV
    with open(caminho_csv, 'w', newline='', encoding='utf-8') as arquivo:
        writer = csv.writer(arquivo)
        
        # Cabeçalho
        writer.writerow(['nome_video', 'nome_thumbnail', 'titulo', 'descricao', 
                        'tags', 'data_publicacao', 'hora_publicacao'])
        
        # Dados
        for i in range(num_videos):
            numero = str(i + 1).zfill(3)  # 001, 002, 003...
            nome_video = f"video_{numero}.mp4"
            nome_thumbnail = f"video_{numero}.png"
            data_publicacao = (data_inicio + timedelta(days=i)).strftime('%Y-%m-%d')
            
            # Converter tags de vírgula para ponto e vírgula
            tags_formatadas = tags[i].replace(',', ';')
            
            writer.writerow([
                nome_video,
                nome_thumbnail,
                titulos[i],
                descricoes[i],
                tags_formatadas,
                data_publicacao,
                horario
            ])
    
    messagebox.showinfo("Sucesso", 
        f"Planilha gerada com sucesso!\n"
        f"Total de vídeos: {num_videos}\n"
        f"Arquivo salvo em: {caminho_csv}")

if __name__ == "__main__":
    gerar_planilha()