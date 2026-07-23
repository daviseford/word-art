def split_into_sentences(text):
    return [sentence.strip().lower() for sentence in text.split(".") if sentence.strip()]


def split_into_sentence_lengths(text):
    return [len(sentence.split()) for sentence in split_into_sentences(text)]
