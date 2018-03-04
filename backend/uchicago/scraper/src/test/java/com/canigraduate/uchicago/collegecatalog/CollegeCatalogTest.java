package com.canigraduate.uchicago.collegecatalog;

import com.canigraduate.uchicago.models.Course;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CollegeCatalogTest {
    @Test
    void getDepartments() throws IOException {
        Map<String, String> departments = CollegeCatalog.getDepartments();
        assertThat(departments).isNotEmpty();
        assertThat(departments).containsEntry("Anthropology",
                "http://collegecatalog.uchicago.edu/thecollege/anthropology/");
    }

    @Test
    void getCoursesAndSequences() throws IOException {
        Map<String, Course> courses = CollegeCatalog.getCoursesAndSequences(
                "http://collegecatalog.uchicago.edu/thecollege/anthropology/");
        assertThat(courses).isNotEmpty();
        assertThat(courses).containsKey("ANTH 11730");
        assertThat(courses.get("ANTH 11730").getName()).isEqualTo(
                "Decolonizing Anthropology: Africana Critical Theory and the Social Sciences");
        assertThat(courses.get("ANTH 11730").getDescription()).isNotEmpty();
        assertThat(courses.get("ANTH 11730").getParent()).isNotPresent();
    }

    @Test
    void getCoursesAndSequences_sequenceParenting() throws IOException {
        Map<String, Course> courses = CollegeCatalog.getCoursesAndSequences(
                "http://collegecatalog.uchicago.edu/thecollege/mathematics/");
        assertThat(courses).isNotEmpty().containsKeys("MATH 15200", "MATH 24400", "MATH 15100-15200-15300");
        assertThat(courses.get("MATH 15200").getName()).isEqualTo("Calculus II");
        assertThat(courses.get("MATH 15200").getParent()).isPresent().contains("MATH 15100-15200-15300");
        assertThat(courses.get("MATH 15200").isLeaf()).isTrue();
        assertThat(courses.get("MATH 24400").getParent()).isNotPresent();
        assertThat(courses.get("MATH 24400").isLeaf()).isTrue();
        assertThat(courses.get("MATH 15100-15200-15300").getParent()).isNotPresent();
        assertThat(courses.get("MATH 15100-15200-15300").isLeaf()).isFalse();
    }
}