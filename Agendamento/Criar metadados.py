import os
import re
from tkinter import Tk, filedialog, messagebox

def ler_titulos(caminho_arquivo):
    """Lê o arquivo de títulos e retorna lista numerada"""
    with open(caminho_arquivo, 'r', encoding='utf-8') as f:
        conteudo = f.read()
    
    titulos = []
    linhas = conteudo.strip().split('\n')
    
    for linha in linhas:
        # Remove numeração se existir (1., 2., etc)
        linha_limpa = linha.strip()
        if linha_limpa:
            # Remove padrão "número." do início
            titulo = re.sub(r'^\d+\.\s*', '', linha_limpa)
            if titulo:
                titulos.append(titulo)
    
    return titulos

def ler_descricao_tags(caminho_arquivo):
    """Lê arquivo de descrição - SEM INSERIR TAGS NAS DESCRIÇÕES"""
    with open(caminho_arquivo, 'r', encoding='utf-8') as f:
        conteudo = f.read().strip()
    
    # REMOVER COMPLETAMENTE qualquer hashtag ou menção a tags
    descricao = re.sub(r'#\w+', '', conteudo)  # Remove hashtags
    descricao = re.sub(r'\bTAGS?\s*:.*', '', descricao, flags=re.IGNORECASE | re.DOTALL)  # Remove linhas de tags
    descricao = re.sub(r'\bHASHTAGS?\s*:.*', '', descricao, flags=re.IGNORECASE | re.DOTALL)  # Remove linhas de hashtags
    
    # Limpar espaços extras e linhas vazias
    descricao = '\n'.join([linha.strip() for linha in descricao.split('\n') if linha.strip()])
    
    # EXTRAIR TAGS SEPARADAMENTE (apenas hashtags do conteúdo original)
    hashtags = re.findall(r'#\w+', conteudo)
    tags = ', '.join([tag[1:] for tag in hashtags]) if hashtags else ""
    
    return descricao, tags

def gerar_arquivo_metadados():
    """Função principal"""
    root = Tk()
    root.withdraw()
    
    # 1. Solicitar arquivo com títulos
    messagebox.showinfo("Passo 1", "Selecione o arquivo com os TÍTULOS")
    caminho_titulos = filedialog.askopenfilename(
        title="Selecione o arquivo com títulos",
        filetypes=[
            ("Text Files", "*.txt"),
            ("Todos os arquivos", "*.*")
        ]
    )
    
    if not caminho_titulos:
        messagebox.showerror("Erro", "Nenhum arquivo selecionado!")
        root.destroy()
        return
    
    # Ler títulos
    try:
        titulos = ler_titulos(caminho_titulos)
    except Exception as e:
        messagebox.showerror("Erro", f"Erro ao ler títulos: {str(e)}")
        root.destroy()
        return
    
    if len(titulos) == 0:
        messagebox.showerror("Erro", "Nenhum título encontrado no arquivo!")
        root.destroy()
        return
    
    num_titulos = len(titulos)
    
    # 2. Solicitar pasta com descrições
    messagebox.showinfo("Passo 2", 
        f"Agora selecione a PASTA com os arquivos de descrição\n\n"
        f"Os arquivos devem estar nomeados como:\n"
        f"Descrição (1).txt\n"
        f"Descrição (2).txt\n"
        f"Descrição (3).txt\n"
        f"...\n\n"
        f"Total esperado: {num_titulos} arquivos")
    
    pasta_descricoes = filedialog.askdirectory(
        title="Selecione a pasta com as descrições"
    )
    
    if not pasta_descricoes:
        messagebox.showerror("Erro", "Nenhuma pasta selecionada!")
        root.destroy()
        return
    
    # 3. Buscar arquivos de descrição na pasta
    caminhos_descricoes = []
    arquivos_faltando = []
    
    for i in range(1, num_titulos + 1):
        nome_arquivo = f"Descrição ({i}).txt"
        caminho_completo = os.path.join(pasta_descricoes, nome_arquivo)
        
        if os.path.exists(caminho_completo):
            caminhos_descricoes.append(caminho_completo)
        else:
            arquivos_faltando.append(nome_arquivo)
    
    # Verificar se encontrou todos os arquivos
    if arquivos_faltando:
        messagebox.showerror("Erro", 
            f"Arquivos não encontrados na pasta:\n\n" + 
            "\n".join(arquivos_faltando[:5]) +
            (f"\n... e mais {len(arquivos_faltando)-5}" if len(arquivos_faltando) > 5 else ""))
        root.destroy()
        return
    
    # 4. Ler descrições e tags
    descricoes = []
    tags = []
    
    try:
        for caminho in caminhos_descricoes:
            desc, tag = ler_descricao_tags(caminho)
            descricoes.append(desc)
            tags.append(tag)
    except Exception as e:
        messagebox.showerror("Erro", f"Erro ao ler descrições: {str(e)}")
        root.destroy()
        return
    
    # Pegar primeira tag válida para usar como padrão
    tag_padrao = ""
    for tag in tags:
        if tag.strip():
            tag_padrao = tag.strip()
            break
    
    # Substituir tags vazias pela tag padrão
    for i in range(len(tags)):
        if not tags[i].strip():
            tags[i] = tag_padrao
    
    # 5. Gerar arquivo de metadados
    pasta_script = os.path.dirname(os.path.abspath(__file__))
    caminho_saida = os.path.join(pasta_script, "metadados.txt")
    
    with open(caminho_saida, 'w', encoding='utf-8') as f:
        # Escrever TÍTULOS
        f.write("TÍTULOS:\n")
        for i, titulo in enumerate(titulos, 1):
            f.write(f"{i}. {titulo}\n")
        
        f.write("\n")
        
        # Escrever DESCRIÇÕES
        f.write("DESCRIÇÕES:\n")
        for i, descricao in enumerate(descricoes, 1):
            f.write(f"{i}. {descricao}\n")
        
        f.write("\n")
        
        # Escrever TAGS
        f.write("TAGS:\n")
        for i, tag in enumerate(tags, 1):
            f.write(f"{i}. {tag}\n")
    
    root.destroy()
    
    messagebox.showinfo("Sucesso", 
        f"Arquivo de metadados gerado com sucesso!\n"
        f"Total de vídeos: {num_titulos}\n"
        f"Arquivo salvo em: {caminho_saida}")

if __name__ == "__main__":
    gerar_arquivo_metadados()